(function() {

var EpixFrame = window.EpixFrame;

window.h = maquette.h;

class EpixDash extends EpixFrame {
  constructor() {
    super();
    this.reloadAnnouncerStats = this.reloadAnnouncerStats.bind(this);
    this.reloadAnnouncerInfo = this.reloadAnnouncerInfo.bind(this);
    this.reloadServerErrors = this.reloadServerErrors.bind(this);
    this.reloadServerInfo = this.reloadServerInfo.bind(this);
    this.reloadSiteInfo = this.reloadSiteInfo.bind(this);
    this.onOpenWebsocket = this.onOpenWebsocket.bind(this);
    this.handleLinkClick = this.handleLinkClick.bind(this);
  }

  init() {
    this.history_state = {};
    this.params = {};
    this.site_info = null;
    this.server_info = null;
    this.announcer_info = null;
    this.announcer_stats = null;
    this.address = null;
    this.on_site_info = new Deferred();
    this.on_server_info = new Deferred();
    this.on_settings = new Deferred();
    this.on_loaded = new Deferred();
    this.settings = null;
    this.server_errors = [];
    this.latest_version = "0.0.1";
    this.latest_rev = 8192;
    this.mode = "Sites";
    this.change_timer = null;
    return document.body.id = "Body" + this.mode;
  }

  addRenderer(node, renderer) {
    this.projector.replace(node, renderer);
    return this.renderers.push(renderer);
  }

  detachRenderers() {
    var i, len, ref, renderer;
    ref = this.renderers;
    for (i = 0, len = ref.length; i < len; i++) {
      renderer = ref[i];
      this.projector.detach(renderer);
    }
    return this.renderers = [];
  }

  setProjectorMode(mode) {
    this.log("setProjectorMode", mode);
    if (this.mode === mode) {
      return;
    }
    this.detachRenderers();
    if (mode === "Files") {
      this.addRenderer($("#PageFiles"), this.page_files.render);
      this.page_files.need_update = true;
    } else if (mode === "Stats") {
      this.addRenderer($("#NetworkStats"), this.page_stats.render);
      this.page_stats.need_update = true;
    } else {
      mode = "Sites";
      this.addRenderer($("#FeedList"), this.feed_list.render);
      this.addRenderer($("#SiteList"), this.site_list.render);
    }
    this.mode = mode;
    return setTimeout(() => {
      document.body.id = "Body" + mode;
      if (this.change_timer) {
        clearInterval(this.change_timer);
      }
      document.body.classList.add("changing");
      return this.change_timer = setTimeout(() => {
        document.body.classList.remove("changing");
      }, 800);
    }, 60);
  }

  createProjector() {
    var url;
    this.projector = maquette.createProjector();
    this.projectors = {};
    this.renderers = [];
    this.site_list = new SiteList();
    this.feed_list = new FeedList();
    this.page_files = new PageFiles();
    this.page_stats = new NetworkStats();
    this.head = new Head();
    this.dashboard = new Dashboard();
    this.mute_list = new MuteList();
    this.console_list = new ConsoleList();
    this.trigger = new Trigger();
    if (base.href.indexOf("?") === -1) {
      url = "";
    } else {
      url = base.href.replace(/.*?\?/, "");
    }
    this.history_state["url"] = url;
    this.loadSettings();
    this.on_site_info.then(() => {
      this.projector.replace($("#Head"), this.head.render);
      this.projector.replace($("#Dashboard"), this.dashboard.render);
      this.projector.merge($("#Trigger"), this.trigger.render);
      this.route(url);
      return this.setProjectorMode(this.mode);
    });
    return setInterval(function() {
      return Page.projector.scheduleRender();
    }, 60 * 1000);
  }

  route(query) {
    this.params = Text.parseQuery(query);
    this.log("Route", this.params);
    this.setProjectorMode(this.params.url);
    if (this.mode === "Stats") {
      this.page_stats.need_update = true;
    } else if (this.mode === "Files") {
      this.page_files.need_update = true;
    }
    return this.projector.scheduleRender();
  }

  createUrl(key, val) {
    var params, vals;
    params = JSON.parse(JSON.stringify(this.params));
    if (typeof key === "Object") {
      vals = key;
      for (key in keys) {
        val = keys[key];
        params[key] = val;
      }
    } else {
      params[key] = val;
    }
    return "?" + Text.encodeQuery(params);
  }

  setUrl(url, mode) {
    if (mode == null) {
      mode = "replace";
    }
    url = url.replace(/.*?\?/, "");
    this.log("setUrl", this.history_state["url"], "->", url);
    if (this.history_state["url"] === url) {
      return false;
    }
    this.history_state["url"] = url;
    if (mode === "replace") {
      this.cmd("wrapperReplaceState", [this.history_state, "", url]);
    } else {
      this.cmd("wrapperPushState", [this.history_state, "", url]);
    }
    this.route(url);
    return false;
  }

  handleLinkClick(e) {
    if (e.which === 2) {
      return true;
    } else {
      this.log("save scrollTop", window.pageYOffset);
      this.history_state["scrollTop"] = window.pageYOffset;
      this.cmd("wrapperReplaceState", [this.history_state, null]);
      window.scroll(window.pageXOffset, 0);
      this.history_state["scrollTop"] = 0;
      this.setUrl(e.currentTarget.search);
      return false;
    }
  }

  loadSettings() {
    return this.on_site_info.then(() => {
      return this.cmd("userGetSettings", [], (res) => {
        var base1, base2, base3, base4;
        if (!res || res.error) {
          return this.loadLocalStorage();
        } else {
          this.settings = res;
          if ((base1 = this.settings).sites_orderby == null) {
            base1.sites_orderby = "peers";
          }
          if ((base2 = this.settings).favorite_sites == null) {
            base2.favorite_sites = {};
          }
          if ((base3 = this.settings).siteblocks_ignore == null) {
            base3.siteblocks_ignore = {};
          }
          if ((base4 = this.settings).date_feed_visit == null) {
            base4.date_feed_visit = 1;
          }
          this.feed_list.date_feed_visit = this.settings.date_feed_visit;
          return this.on_settings.resolve(this.settings);
        }
      });
    });
  }

  loadLocalStorage() {
    return this.cmd("wrapperGetLocalStorage", [], (settings) => {
      var base1, base2;
      this.settings = settings;
      this.log("Loaded localstorage");
      if (this.settings == null) {
        this.settings = {};
      }
      if ((base1 = this.settings).sites_orderby == null) {
        base1.sites_orderby = "peers";
      }
      if ((base2 = this.settings).favorite_sites == null) {
        base2.favorite_sites = {};
      }
      return this.on_settings.resolve(this.settings);
    });
  }

  saveSettings(cb) {
    if (this.settings) {
      return this.cmd("userSetSettings", [this.settings], (res) => {
        if (cb) {
          return cb(res);
        }
      });
    }
  }

  onOpenWebsocket(e) {
    this.reloadServerInfo();
    this.reloadServerErrors();
    return this.reloadSiteInfo();
  }

  reloadSiteInfo() {
    return this.cmd("siteInfo", {}, (site_info) => {
      this.address = site_info.address;
      return this.setSiteInfo(site_info);
    });
  }

  reloadServerInfo(cb) {
    return this.cmd("serverInfo", {}, (server_info) => {
      this.setServerInfo(server_info);
      return typeof cb === "function" ? cb(server_info) : void 0;
    });
  }

  reloadServerErrors(cb) {
    return this.cmd("serverErrors", {}, (server_errors) => {
      this.setServerErrors(server_errors);
      return typeof cb === "function" ? cb(server_errors) : void 0;
    });
  }

  reloadAnnouncerInfo(cb) {
    return this.cmd("announcerInfo", {}, (announcer_info) => {
      this.setAnnouncerInfo(announcer_info);
      return typeof cb === "function" ? cb() : void 0;
    });
  }

  reloadAnnouncerStats(cb) {
    return this.cmd("announcerStats", {}, (announcer_stats) => {
      this.announcer_stats = announcer_stats;
      Page.projector.scheduleRender();
      return typeof cb === "function" ? cb() : void 0;
    });
  }

  onRequest(cmd, message) {
    var params = message.params;
    if (cmd === "setSiteInfo") {
      return this.setSiteInfo(params);
    } else if (cmd === "setServerInfo") {
      return this.setServerInfo(params);
    } else if (cmd === "setAnnouncerInfo") {
      return this.setAnnouncerInfo(params);
    } else {
      return this.log("Unknown command", params);
    }
  }

  setSiteInfo(site_info) {
    if (site_info.address === this.address) {
      this.site_info = site_info;
      if (this.server_info) {
        this.reloadAnnouncerStats();
      }
    }
    this.site_list.onSiteInfo(site_info);
    this.feed_list.onSiteInfo(site_info);
    this.page_files.onSiteInfo(site_info);
    return this.on_site_info.resolve();
  }

  setServerInfo(server_info) {
    var ref;
    this.server_info = server_info;
    if (server_info.language) {
      loadLanguage(server_info.language);
    } else if (!this._lang_detected) {
      this._lang_detected = true;
      var supported = ["ar", "da", "de", "en", "es", "fa", "fr", "hu", "it", "nl", "pl", "pt", "pt-br", "ru", "sk", "tr", "uk", "zh", "zh-tw", "jp", "sl", "kr"];
      var browser_lang = (navigator.language || "").toLowerCase();
      var detected = null;
      if (supported.indexOf(browser_lang) >= 0) {
        detected = browser_lang;
      } else {
        var short_lang = browser_lang.split("-")[0];
        if (short_lang === "ja") short_lang = "jp";
        if (supported.indexOf(short_lang) >= 0) {
          detected = short_lang;
        }
      }
      if (detected && detected !== "en") {
        server_info.language = detected;
        loadLanguage(detected);
        this.cmd("configSet", ["language", detected]);
      }
    }
    this.projector.scheduleRender();
    if (((ref = server_info.event) != null ? ref[0] : void 0) === "log_event") {
      RateLimit(1000, () => {
        return this.reloadServerErrors();
      });
    }
    return this.on_server_info.resolve();
  }

  setServerErrors(server_errors) {
    var date_added, i, len, level, message, ref;
    this.server_errors = [];
    for (i = 0, len = server_errors.length; i < len; i++) {
      ref = server_errors[i], date_added = ref[0], level = ref[1], message = ref[2];
      this.server_errors.push({
        title: [Time.since(date_added), " - ", level],
        descr: message,
        href: null
      });
    }
    return this.projector.scheduleRender();
  }

  setAnnouncerInfo(announcer_info) {
    this.announcer_info = announcer_info.stats;
    return this.projector.scheduleRender();
  }

  returnFalse() {
    return false;
  }

  updateEpixNet() {
    Page.cmd("wrapperNotification", ["info", "please update epixnet-conservancy via git", 8000]);
  }
}

window.Page = new EpixDash();

window.Page.createProjector();

})();
