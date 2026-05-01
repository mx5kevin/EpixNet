(function() {

class Head {
  constructor() {
    this.render = this.render.bind(this);
    this.handleModeClick = this.handleModeClick.bind(this);
    this.handleShutdownEpixNetClick = this.handleShutdownEpixNetClick.bind(this);
    this.handleUpdateEpixNetClick = this.handleUpdateEpixNetClick.bind(this);
    this.handleManageBlocksClick = this.handleManageBlocksClick.bind(this);
    this.handleTorClick = this.handleTorClick.bind(this);
    this.handleOrderbyClick = this.handleOrderbyClick.bind(this);
    this.handleUpdateAllClick = this.handleUpdateAllClick.bind(this);
    this.handleSettingsClick = this.handleSettingsClick.bind(this);
    this.handleBackupClick = this.handleBackupClick.bind(this);
    this.handleConsoleClick = this.handleConsoleClick.bind(this);
    this.handleCreateSiteClick = this.handleCreateSiteClick.bind(this);
    this.renderMenuTheme = this.renderMenuTheme.bind(this);
    this.handleThemeClick = this.handleThemeClick.bind(this);
    this.renderMenuLanguage = this.renderMenuLanguage.bind(this);
    this.handleLanguageClick = this.handleLanguageClick.bind(this);
    this.menu_settings = new Menu();
  }

  formatUpdateInfo() {
    if (parseFloat(Page.server_info.version.replace(".", "0")) < parseFloat(Page.latest_version.replace(".", "0"))) {
      return "New version available!";
    } else {
      return "Up to date!";
    }
  }

  handleLanguageClick(e) {
    var lang;
    lang = e.target.hash.replace("#", "");
    Page.cmd("configSet", ["language", lang], function() {
      Page.server_info.language = lang;
      loadLanguage(lang);
      Page.projector.scheduleRender();
    });
    return false;
  }

  renderMenuLanguage() {
    var lang, langs, ref;
    langs = ["ar", "da", "de", "en", "es", "fa", "fr", "hu", "it", "jp", "nl", "pl", "pt", "pt-br", "ru", "sk", "sl", "tr", "uk", "zh", "zh-tw", "kr"];
    if (Page.server_info.language && Page.server_info.language.length >= 2 && (ref = Page.server_info.language, langs.indexOf(ref) < 0)) {
      langs.push(Page.server_info.language);
    }
    return h("div.menu-radio", h("div", _("Language: ")), (() => {
      var i, len, results;
      results = [];
      for (i = 0, len = langs.length; i < len; i++) {
        lang = langs[i];
        if (lang === "pt") {
          results.push([
            h("span.lang-pair", [
              h("a.half", {
                href: "#pt",
                onclick: this.handleLanguageClick,
                classes: { selected: Page.server_info.language === "pt" }
              }, "pt"),
              h("a.half", {
                href: "#pt-br",
                onclick: this.handleLanguageClick,
                classes: { selected: Page.server_info.language === "pt-br" }
              }, "pt-br")
            ]), " "
          ]);
        } else if (lang === "pt-br") {
          continue;
        } else {
          results.push([
            h("a", {
              href: "#" + lang,
              onclick: this.handleLanguageClick,
              classes: {
                selected: Page.server_info.language === lang,
                long: lang.length > 2
              }
            }, lang), " "
          ]);
        }
      }
      return results;
    })());
  }

  handleThemeClick(e) {
    var DARK, mqDark, theme;
    theme = e.target.hash.replace("#", "");
    if (theme === "system") {
      DARK = "(prefers-color-scheme: dark)";
      mqDark = window.matchMedia(DARK);
    }
    Page.cmd("userGetGlobalSettings", [], function(user_settings) {
      if (theme === "system") {
        theme = mqDark.matches ? "dark" : "light";
        user_settings.use_system_theme = true;
      } else {
        user_settings.use_system_theme = false;
      }
      user_settings.theme = theme;
      Page.server_info.user_settings = user_settings;
      document.getElementById("style-live").innerHTML = "* { transition: all 0.5s ease-in-out }";
      Page.cmd("userSetGlobalSettings", [user_settings]);
      return setTimeout(function() {
        document.body.className = document.body.className.replace(/theme-[a-z]+/, "");
        document.body.className += " theme-" + theme;
        return setTimeout(function() {
          return document.getElementById("style-live").innerHTML = "";
        }, 1000);
      }, 300);
    });
    return false;
  }

  renderMenuTheme() {
    var ref, theme, theme_names, theme_selected, themes;
    themes = ["system", "light", "dark"];
    theme_names = {"system": _("System"), "light": _("Light"), "dark": _("Dark")};
    if (Page.server_info.user_settings.use_system_theme) {
      theme_selected = "system";
    } else {
      theme_selected = (ref = Page.server_info.user_settings) != null ? ref.theme : void 0;
      if (!theme_selected) {
        theme_selected = "system";
      }
    }
    return h("div.menu-radio.menu-themes", h("div", _("Theme: ")), (() => {
      var i, len, results;
      results = [];
      for (i = 0, len = themes.length; i < len; i++) {
        theme = themes[i];
        results.push([
          h("a", {
            href: "#" + theme,
            onclick: this.handleThemeClick,
            classes: {
              selected: theme_selected === theme,
              long: true
            }
          }, theme_names[theme] || theme), " "
        ]);
      }
      return results;
    })());
  }

  handleCreateSiteClick() {
    return Page.cmd("siteClone", [Page.site_info.address, "template-new"]);
  }

  handleBackupClick() {
    Page.cmd("serverShowdirectory", "backup");
    return Page.cmd("wrapperNotification", ["info", "Backup <b>users.json</b> file to keep your identity safe."]);
  }

  handleSettingsClick() {
    var base, orderby;
    if ((base = Page.settings).sites_orderby == null) {
      base.sites_orderby = "peers";
    }
    orderby = Page.settings.sites_orderby;
    this.menu_settings.items = [];
    this.menu_settings.items.push([_("Update all sites"), this.handleUpdateAllClick]);
    this.menu_settings.items.push(["---"]);
    this.menu_settings.items.push([
      _("Order sites by peers"), (() => {
        return this.handleOrderbyClick("peers");
      }), orderby === "peers"
    ]);
    this.menu_settings.items.push([
      _("Order sites by update time"), (() => {
        return this.handleOrderbyClick("modified");
      }), orderby === "modified"
    ]);
    this.menu_settings.items.push([
      _("Order sites by add time"), (() => {
        return this.handleOrderbyClick("addtime");
      }), orderby === "addtime"
    ]);
    this.menu_settings.items.push([
      _("Order sites by size"), (() => {
        return this.handleOrderbyClick("size");
      }), orderby === "size"
    ]);
    this.menu_settings.items.push(["---"]);
    this.menu_settings.items.push([this.renderMenuTheme(), null]);
    this.menu_settings.items.push(["---"]);
    this.menu_settings.items.push([this.renderMenuLanguage(), null]);
    this.menu_settings.items.push(["---"]);
    this.menu_settings.items.push([_("Create new, empty site"), this.handleCreateSiteClick]);
    this.menu_settings.items.push(["---"]);
    this.menu_settings.items.push([[h("div.icon-mute", ""), _("Manage blocked users and sites")], this.handleManageBlocksClick]);
    if (Page.server_info.plugins.indexOf("UiConfig") >= 0) {
      this.menu_settings.items.push([[h("div.icon-gear.emoji", "\u2699\uFE0E"), _("Configuration")], "/Config"]);
    }
    if (Page.server_info.plugins.indexOf("UiPluginManager") >= 0) {
      this.menu_settings.items.push([[h("div.icon-gear.emoji", "\u2B21"), _("Plugins")], "/Plugins"]);
    }
    if (Page.server_info.plugins.indexOf("Stats") >= 0) {
      this.menu_settings.items.push([_("Stats"), "/Stats"]);
    }
    this.menu_settings.items.push(["---"]);
    if (!Page.server_info.multiuser || Page.server_info.multiuser_admin) {
      this.menu_settings.items.push([_("Show data directory"), this.handleBackupClick]);
      this.menu_settings.items.push([_("Show console"), this.handleConsoleClick]);
    }
    this.menu_settings.items.push([_("Version ") + Page.server_info.version + " (rev" + Page.server_info.rev + ")"]);
    if (!Page.server_info.multiuser || Page.server_info.multiuser_admin) {
      this.menu_settings.items.push([_("Shut down EpixNet"), this.handleShutdownEpixNetClick]);
    }
    if (this.menu_settings.visible) {
      this.menu_settings.hide();
    } else {
      this.menu_settings.show();
    }
    return false;
  }

  handleUpdateAllClick() {
    var i, len, ref, results, site;
    ref = Page.site_list.sites;
    results = [];
    for (i = 0, len = ref.length; i < len; i++) {
      site = ref[i];
      if (site.row.settings.serving) {
        results.push(Page.cmd("siteUpdate", {
          "address": site.row.address
        }));
      } else {
        results.push(void 0);
      }
    }
    return results;
  }

  handleOrderbyClick(orderby) {
    Page.settings.sites_orderby = orderby;
    Page.site_list.reorder();
    return Page.saveSettings();
  }

  handleTorClick() {
    return true;
  }

  handleManageBlocksClick() {
    Page.projector.replace($("#MuteList"), Page.mute_list.render);
    return Page.mute_list.show();
  }

  handleConsoleClick() {
    Page.projector.replace($("#ConsoleList"), Page.console_list.render);
    return Page.console_list.show();
  }

  handleUpdateEpixNetClick() {
    return false;
  }

  handleShutdownEpixNetClick() {
    return Page.cmd("wrapperConfirm", ["Are you sure?", "Shut down EpixNet"], () => {
      return Page.cmd("serverShutdown");
    });
  }

  handleModeClick(e) {
    Page.handleLinkClick(e);
    return false;
  }

  render() {
    return h("div#Head", h("a.settings", {
      href: "#Settings",
      onmousedown: this.handleSettingsClick,
      onclick: Page.returnFalse
    }, ["\u22EE"]), this.menu_settings.render(), h("a.logo", {
      href: "?"
    }, [
      h("img", {src: "img/logo.png", height: 40}),
      h("span", [_("EpixNet Dashboard")])
    ]), h("div.modes", [
      h("a.mode.sites", {
        href: "?",
        classes: {
          active: Page.mode === "Sites"
        },
        onclick: Page.handleLinkClick
      }, _("Sites")),
      h("a.mode.files", {
        href: "?Files",
        classes: {
          active: Page.mode === "Files"
        },
        onclick: Page.handleLinkClick
      }, _("Files")),
      h("a.mode.stats", {
        href: "?Stats",
        classes: {
          active: Page.mode === "Stats"
        },
        onclick: Page.handleLinkClick
      }, _("Stats"))
    ]));
  }
}

Object.assign(Head.prototype, LogMixin);

window.Head = Head;

})();
