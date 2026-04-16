
/* ---- Notification.js ---- */


(function() {
  var NotificationBadge;

  NotificationBadge = (function() {
    function NotificationBadge(wrapper) {
      this.wrapper = wrapper;
      this.badge = null;
      this.results = [];
      this.muted = false;
      this.poll_interval = 60000;
      this.poll_timer = null;
      this.initialized = false;

      this.createBadge();
      this.hookWebsocket();
      this.waitForConnection();
    }

    NotificationBadge.prototype.log = function() {
      var args;
      args = 1 <= arguments.length ? [].slice.call(arguments, 0) : [];
      return console.log.apply(console, ["[NotificationBadge]"].concat(args));
    };

    NotificationBadge.prototype.createBadge = function() {
      this.badge = document.createElement("span");
      this.badge.className = "fixbutton-badge";
      this.badge.style.display = "none";
      var fixbutton = document.querySelector(".fixbutton");
      if (fixbutton) {
        fixbutton.appendChild(this.badge);
      }
    };

    NotificationBadge.prototype.waitForConnection = function() {
      var _this = this;
      // Wait until websocket is connected before first query
      var check = function() {
        if (_this.wrapper.ws && _this.wrapper.ws.connected) {
          _this.query();
          _this.startPolling();
        } else {
          setTimeout(check, 1000);
        }
      };
      setTimeout(check, 2000);
    };

    NotificationBadge.prototype.hookWebsocket = function() {
      var _this = this;
      var original = this.wrapper.handleMessageWebsocket;
      this.wrapper.handleMessageWebsocket = function(message) {
        // When any site has a file_done event, re-query notifications
        if (message.cmd === "setSiteInfo" && message.params && message.params.event) {
          if (message.params.event[0] === "file_done") {
            // Debounce: wait a moment for DB to update, then re-query
            if (_this._file_done_timer) clearTimeout(_this._file_done_timer);
            _this._file_done_timer = setTimeout(function() {
              _this.query();
            }, 3000);
          }
        }
        return original.call(_this.wrapper, message);
      };
    };

    NotificationBadge.prototype.startPolling = function() {
      var _this = this;
      if (this.poll_timer) clearInterval(this.poll_timer);
      this.poll_timer = setInterval(function() {
        _this.query();
      }, this.poll_interval);
    };

    NotificationBadge.prototype.query = function() {
      var _this = this;
      if (!this.wrapper.ws || !this.wrapper.ws.connected) return;

      this.wrapper.ws.cmd("notificationQuery", {}, function(res) {
        if (!res || res.error) {
          _this.log("Query error:", res);
          return;
        }
        _this.muted = !!res.muted;
        _this.results = res.results || [];
        _this.updateBadge();
      });
    };

    NotificationBadge.prototype.updateBadge = function() {
      var total = 0;
      for (var i = 0; i < this.results.length; i++) {
        var r = this.results[i];
        if (r.count && r.count > 0) {
          total += r.count;
        }
      }

      if (total > 0) {
        this.badge.textContent = total > 99 ? "\u221E" : total.toString();
        this.badge.style.display = "flex";
        this.badge.title = this.buildTooltip();
      } else {
        this.badge.style.display = "none";
        this.badge.title = "";
      }
    };

    NotificationBadge.prototype.buildTooltip = function() {
      var parts = [];
      for (var i = 0; i < this.results.length; i++) {
        var r = this.results[i];
        if (r.count && r.count > 0) {
          parts.push(r.count + " " + (r.title || r.name));
        }
      }
      return parts.join("\n");
    };

    // Get full icon URL for a result entry (for dashboard rendering)
    // Site declares "notification_icons": {"name": "img/icon.png"} in content.json
    // Full URL: /{site_address}/{icon_path}
    NotificationBadge.prototype.getIconUrl = function(result) {
      if (result.icon) {
        return "/" + result.site + "/" + result.icon;
      }
      return null;
    };

    // Get results with count > 0 (convenience for dashboard)
    NotificationBadge.prototype.getActiveResults = function() {
      var active = [];
      for (var i = 0; i < this.results.length; i++) {
        if (this.results[i].count > 0) {
          active.push(this.results[i]);
        }
      }
      return active;
    };

    // Mute all notifications globally, or mute a specific site
    // site_address: optional — omit to mute/unmute globally
    NotificationBadge.prototype.mute = function(muted, site_address, cb) {
      var _this = this;
      var params = { muted: muted };
      if (site_address) params.site_address = site_address;
      this.wrapper.ws.cmd("notificationMute", params, function(res) {
        _this.query();
        if (cb) cb(res);
      });
    };

    // Get full mute status (global + per-site map)
    NotificationBadge.prototype.getMuteStatus = function(cb) {
      this.wrapper.ws.cmd("notificationMuteStatus", {}, cb);
    };

    return NotificationBadge;
  })();

  // Initialize after wrapper is ready (same pattern as Sidebar)
  var wrapper = window.wrapper;
  if (wrapper) {
    setTimeout(function() {
      window.notificationBadge = new NotificationBadge(wrapper);
    }, 800);
  }

}).call(this);
