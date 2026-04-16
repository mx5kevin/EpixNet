import re
import os
import time

from Config import config
from Plugin import PluginManager
from Debug import Debug
from util import helper
from util.Flag import flag


plugin_dir = os.path.dirname(__file__)
media_dir = plugin_dir + "/media"

# Track previous notification totals per user to detect increases for tray toast
_last_totals = {}


@PluginManager.registerTo("UiRequest")
class UiRequestPlugin(object):
    def actionUiMedia(self, path):
        if path == "/uimedia/all.js" or path == "/uimedia/all.css":
            # First yield the original file and header
            body_generator = super(UiRequestPlugin, self).actionUiMedia(path)
            for part in body_generator:
                yield part

            # Append notification plugin media
            ext = re.match(".*(js|css)$", path).group(1)
            plugin_media_file = "%s/all.%s" % (media_dir, ext)
            if config.debug:
                from Debug import DebugMedia
                DebugMedia.merge(plugin_media_file)
            if ext == "js":
                yield open(plugin_media_file).read().encode("utf8")
            else:
                for part in self.actionFile(plugin_media_file, send_header=False):
                    yield part
        else:
            for part in super(UiRequestPlugin, self).actionUiMedia(path):
                yield part


@PluginManager.registerTo("UiWebsocket")
class UiWebsocketPlugin(object):
    # Subscribe to notification queries for a site
    def actionNotificationSubscribe(self, to, subscriptions):
        self.user.setNotificationSubscriptions(self.site.address, subscriptions)
        self.user.save()
        self.response(to, "ok")

    # List current notification subscriptions for the current site
    def actionNotificationList(self, to):
        notifications = self.user.sites.get(self.site.address, {}).get("notifications", {})
        self.response(to, notifications)

    # Mute/unmute notifications globally or per-site
    # muted: bool — the mute state to set
    # site_address: optional — if provided, mute only that site; otherwise mute all
    @flag.admin
    def actionNotificationMute(self, to, muted, site_address=None):
        muted = bool(muted)
        if site_address:
            # Per-site mute
            site_data = self.user.getSiteData(site_address)
            site_data["notification_muted"] = muted
        else:
            # Global mute
            self.user.settings["notification_muted"] = muted
        self.user.save()
        self.response(to, "ok")

    # Get current mute settings
    @flag.admin
    def actionNotificationMuteStatus(self, to):
        global_muted = self.user.settings.get("notification_muted", False)

        # Collect per-site mute states for sites that have notification subscriptions
        site_mutes = {}
        for address, site_data in list(self.user.sites.items()):
            if not site_data.get("notifications"):
                continue
            site_mutes[address] = site_data.get("notification_muted", False)

        self.response(to, {
            "global_muted": global_muted,
            "site_mutes": site_mutes
        })

    # Query notification counts across all subscribed sites
    @flag.admin
    def actionNotificationQuery(self, to):
        from Site import SiteManager

        # Check global mute
        if self.user.settings.get("notification_muted", False):
            return self.response(to, {
                "results": [],
                "num": 0,
                "sites": 0,
                "taken": 0,
                "muted": True
            })

        results = []
        total_s = time.time()
        num_sites = 0

        for address, site_data in list(self.user.sites.items()):
            subscriptions = site_data.get("notifications")
            if not subscriptions:
                continue
            if type(subscriptions) is not dict:
                self.log.debug("Invalid notifications for site %s" % address)
                continue

            # Check per-site mute
            if site_data.get("notification_muted", False):
                continue

            site = SiteManager.site_manager.get(address)
            if not site or not site.storage.has_db:
                continue

            num_sites += 1
            content_json = site.content_manager.contents.get("content.json", {})
            title = content_json.get("title", address)
            # Icons: site declares "notification_icons" dict in content.json
            # Maps notification name to icon path: {"new_mail": "img/notif-mail.png", ...}
            icons = content_json.get("notification_icons", {})
            if not isinstance(icons, dict):
                icons = {}

            for name, query_set in subscriptions.items():
                s = time.time()
                try:
                    query_raw, params = query_set
                    if not re.match(r'^SELECT\s', query_raw, re.IGNORECASE):
                        self.log.error("Notification query must start with SELECT: %s" % name)
                        continue

                    query = query_raw
                    if params:
                        query_params = map(helper.sqlquote, params)
                        query = query.replace(":params", ",".join(query_params))

                    # Replace {xid_directory} placeholder with user's directory for this site
                    if "{xid_directory}" in query:
                        xid_dir = self.user.getUserDirectory(address)
                        if not xid_dir:
                            continue
                        query = query.replace("{xid_directory}", xid_dir)

                    # Replace {last_seen} with dismiss timestamp so queries can filter
                    dismissed = site_data.get("notification_dismissed", {})
                    last_seen = dismissed.get(name, 0)
                    if "{last_seen}" in query:
                        query = query.replace("{last_seen}", str(int(last_seen)))

                    res = site.storage.query(query)
                    row = next(res, None)
                    if row:
                        row = dict(row)
                        count = row.get("count", row.get("COUNT(*)", 0))
                    else:
                        count = 0

                    # Subtract dismissed count baseline so only new items show
                    dismissed_counts = site_data.get("notification_dismissed_count", {})
                    baseline = dismissed_counts.get(name, 0)
                    count = max(0, count - baseline)

                    result_entry = {
                        "site": address,
                        "title": title,
                        "name": name,
                        "count": count,
                        "last_seen": last_seen,
                        "taken": round(time.time() - s, 3)
                    }
                    # Look up per-notification icon from the site's icon map
                    icon = icons.get(name)
                    if icon:
                        result_entry["icon"] = icon
                    results.append(result_entry)
                except Exception as err:
                    self.log.error("%s notification query %s error: %s" % (address, name, Debug.formatException(err)))
                    results.append({
                        "site": address,
                        "title": title,
                        "name": name,
                        "count": 0,
                        "error": str(err)
                    })

                time.sleep(0.001)

        # Fire OS tray toast if notification count increased
        new_total = sum(r.get("count", 0) for r in results)
        user_key = getattr(self.user, "master_address", "default")
        prev_total = _last_totals.get(user_key, 0)
        _last_totals[user_key] = new_total

        if new_total > prev_total:
            try:
                import main
                announce = getattr(main.actions, "announce", None)
                if announce:
                    parts = []
                    for r in results:
                        if r.get("count", 0) > 0:
                            parts.append("%s %s" % (r["count"], r.get("title", r.get("name", ""))))
                    if parts:
                        announce("\n".join(parts), title="")
            except Exception as err:
                self.log.error("Notification toast error: %s" % Debug.formatException(err))

        return self.response(to, {
            "results": results,
            "num": len(results),
            "sites": num_sites,
            "taken": round(time.time() - total_s, 3)
        })

    def _dismissNotification(self, site_address, name):
        """Snapshot current query count as baseline so only new items trigger alerts."""
        from Site import SiteManager

        site_data = self.user.getSiteData(site_address)
        if "notification_dismissed" not in site_data:
            site_data["notification_dismissed"] = {}
        site_data["notification_dismissed"][name] = int(time.time() * 1000)

        # Store current raw count as baseline
        if "notification_dismissed_count" not in site_data:
            site_data["notification_dismissed_count"] = {}
        subscriptions = site_data.get("notifications", {})
        query_set = subscriptions.get(name)
        if query_set:
            try:
                site = SiteManager.site_manager.get(site_address)
                if site and site.storage.has_db:
                    query_raw, params = query_set
                    query = query_raw
                    if params:
                        query_params = map(helper.sqlquote, params)
                        query = query.replace(":params", ",".join(query_params))
                    if "{xid_directory}" in query:
                        xid_dir = self.user.getUserDirectory(site_address)
                        if xid_dir:
                            query = query.replace("{xid_directory}", xid_dir)
                    if "{last_seen}" in query:
                        query = query.replace("{last_seen}", "0")
                    res = site.storage.query(query)
                    row = next(res, None)
                    if row:
                        row = dict(row)
                        site_data["notification_dismissed_count"][name] = row.get("count", row.get("COUNT(*)", 0))
            except Exception as err:
                self.log.error("Dismiss count snapshot error: %s" % err)

        self.user.save()

    # Dismiss (mark as seen) notifications for a site
    @flag.admin
    def actionNotificationDismiss(self, to, site_address, name):
        self._dismissNotification(site_address, name)
        self.response(to, "ok")

    # Dismiss own site's notifications (callable from within the site iframe, no admin needed)
    def actionNotificationDismissSelf(self, to, name):
        self._dismissNotification(self.site.address, name)
        self.response(to, "ok")


@PluginManager.registerTo("User")
class UserPlugin(object):
    def setNotificationSubscriptions(self, address, subscriptions):
        site_data = self.getSiteData(address)
        site_data["notifications"] = subscriptions
        self.save()
        return site_data
