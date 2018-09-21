const St = imports.gi.St;

const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Atk = imports.gi.Atk;

const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Gettext = imports.gettext.domain('lock-keys-osd');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

//For overwriting OSD window:
const HIDE_TIMEOUT = imports.ui.osdWindow.HIDE_TIMEOUT;
const FADE_TIME = imports.ui.osdWindow.FADE_TIME;
const Tweener = imports.ui.tweener;
const Meta = imports.gi.Meta;
const osdWindow = imports.ui.osdWindow;

const setting = Convenience.getSettings();

//detect the keyboard key press event
const Gdk = imports.gi.Gdk;
const Keymap = Gdk.Keymap.get_default();

let capStatus, numStatus, scrollStatus, _KeyStatusId, enabled;

//Saves the old UI elements that we replace:
var oldOsdWindows = [];
//Saves the old functions that we replace:
var oldManagerShow, oldManagerShowOsdWindow, oldManagerMonitorsChanged;

    
//>=3.30: Adds maxLevel parameter to show()
let useMaxLevel = null;

//Custom version of js/ui/osdWindow's OsdWindowManager's function show(...):
//Adds stay parameter.
//If <3.30, then maxLevel is where the stay value is
function newManagerShow(monitorIndex, icon, label, level, maxLevel, stay) {
    if (monitorIndex != -1) {
        for (let i = 0; i < this._osdWindows.length; i++) {
            if (i == monitorIndex)
                this._showOsdWindow(i, icon, label, level, maxLevel, stay);
            else
                this._osdWindows[i].cancel();
        }
    } else {
        for (let i = 0; i < this._osdWindows.length; i++)
            this._showOsdWindow(i, icon, label, level, maxLevel, stay);
    }
}

//Custom version of js/ui/osdWindow's OsdWindowManager's function _showOsdWindow(...):
//Adds stay parameter.
//If <3.30, then maxLevel is where the stay value is
function newManagerShowOsdWindow(monitorIndex, icon, label, level, maxLevel, stay) {
    this._osdWindows[monitorIndex].setIcon(icon);
    this._osdWindows[monitorIndex].setLabel(label);
    this._osdWindows[monitorIndex].setLevel(level);
    if(this._osdWindows[monitorIndex].setMaxLevel != null) {
        //Added in 3.30
        this._osdWindows[monitorIndex].setMaxLevel(maxLevel)
        this._osdWindows[monitorIndex].show(stay);
    } else {
        //<3.28 fallback
        this._osdWindows[monitorIndex].show(maxLevel);
    }
}

//Custom version of js/ui/osdWindow's OsdWindowManager's function _monitorsChanged(...):
//Instead of just doing to normal OsdWindow's, it does to OsdKeepWindow's,
//AND it will update the oldOsdWindows array with new/deleted OsdWindow's.
//So that the OsdKeepWindows and oldOsdWindows are in-sync.
function newManagerMonitorsChanged() {
    for (let i = 0; i < Main.layoutManager.monitors.length; i++) {
        if (this._osdWindows[i] == undefined) {
            this._osdWindows[i] = new OsdKeepWindow(i);
            oldOsdWindows[i] = new OsdWindow(i);
        }
    }

    for (let i = Main.layoutManager.monitors.length; i < this._osdWindows.length; i++) {
        this._osdWindows[i].actor.destroy();
        this._osdWindows[i] = null;
        oldOsdWindows[i].actor.destroy();
        oldOsdWindows[i] = null;
    }

    this._osdWindows.length = Main.layoutManager.monitors.length;
}

/*When the extension runs, we replace Main.osdWindowManager._osdWindows
  elements with this:
  
  The modification mainly involves an added "stay" parameter to the show function,
  which makes the window show persistently, instead of fading out after a timeout.
*/
var OsdKeepWindow = Lang.Class({
    Name:'OsdKeepWindow',
    Extends:osdWindow.OsdWindow,
    _init:function OsdKeepWindow(monitorIndex) {
        this.parent(monitorIndex);
        
        //Current state, shown or hidden.
        //Only set when stay parameter == true
        this.staying = false;
    },
    
    //For when the extension turns on & off:
    //This function converts a normal OsdWindow to our custom OsdKeepWindow
    copy_from:function(osdWindow) {
        
        //Copy properties:
        this.setLabel(osdWindow._label.text);
        this.setIcon(osdWindow._icon.gicon);
        if(osdWindow._level.actor.visible)
            this.setLevel(osdWindow._level.level);
        else
            this.setLevel();
        
    },
    
    //Reverse of from: Copies THIS OSD to the given one,
    //Hiding this and showing that.
    copy_to:function(osdWindow) {
        
        //Copy properties from widget:
        osdWindow.setLabel(this._label.text);
        osdWindow.setIcon(this._icon.gicon);
        if(this._level.actor.visible)
            osdWindow.setLevel(this._level.level);
        else
            osdWindow.setLevel();
        
        //Removes any 'staying' OSDs:
        this.cancel();
        
    },
    
    show: function(stay) {
        if(!stay) stay = false;
        
        //Copied from js/ui/osdWindow.js
        if (!this._icon.gicon)
            return;

        //Fade-In animation:
        if (!this.actor.visible) {
            if(global.screen) //<3.30
                Meta.disable_unredirect_for_screen(global.screen);
            else //>= 3.30
                Meta.disable_unredirect_for_display(global.display);
            this.actor.opacity = 0;
            this.actor.get_parent().set_child_above_sibling(this.actor, null);

            Tweener.addTween(this.actor,
                             { opacity: 255,
                               time: FADE_TIME,
                               transition: 'easeOutQuad' });
           
        }
        
        //New function to do this, depending on if stay == true or false.
        this._setTimer(stay);
    },
    //Does the timing stuff from osdWindow.js, only if stay == false
    //Also does the actor.show() stuff from osdWindow.js
    _setTimer:function(stay) {
        this.staying = stay;
        
        if (this._hideTimeoutId)
            Mainloop.source_remove(this._hideTimeoutId);
        
        //TIMEOUT:
        if(!stay) {
            this._hideTimeoutId = Mainloop.timeout_add(HIDE_TIMEOUT,
                                                       Lang.bind(this, this._hide));
            GLib.Source.set_name_by_id(this._hideTimeoutId, '[gnome-shell] this._hide');
        } //else NO TIMEOUT
        
        this.actor.show();
    },
    
    cancel: function() {
        //Added: if this.staying, this._hide(); otherwise the same logic.
        //Because a staying OSD Doesn't have a _hideTimeoutId.
        if (this._hideTimeoutId) {
            Mainloop.source_remove(this._hideTimeoutId);
            this._hide();
        } else if(this.staying) {
            this._hide();
        }
    },

    _hide: function() {
        //Added this.staying = false, otherwise the same
        this._hideTimeoutId = 0;
        Tweener.addTween(this.actor,
                         { opacity: 0,
                           time: FADE_TIME,
                           transition: 'easeOutQuad',
                           onComplete: Lang.bind(this, function() {
                              this._reset();
                              if(global.screen) //<3.30
                                  Meta.enable_unredirect_for_screen(global.screen);
                              else //>=3.30
                                  Meta.enable_unredirect_for_display(global.display);
                           })
                         });
        this.staying = false; //only Difference
        return GLib.SOURCE_REMOVE;
    },

    setLabel: function(label) {
        //A blank label would not set the label.
        //But we want to be able to set a blank label.
        //so instead of if(label), we do if(label != undefined)
        this._label.visible = (label != undefined);
        if (label != undefined)
            this._label.text = label;
    },
});
    
//Equivalent to old _popupStyle or _grayoutStyle
//But since there's no style, name is changed.
function update() {
    let newCapStatus = Keymap.get_caps_lock_state();
    let newNumStatus = Keymap.get_num_lock_state();
    let newScrollStatus = Keymap.get_scroll_lock_state();
    
    updateKey('caps',   capStatus,    newCapStatus) ||
    updateKey('num',    numStatus,    newNumStatus) ||
    updateKey('scroll', scrollStatus, newScrollStatus);
    
    capStatus = newCapStatus;
    numStatus = newNumStatus;
    scrollStatus = newScrollStatus;
}

/*
    Shows the given key if it's status has changed.
    keyname: 'caps', 'num', or 'scroll' (From settings prefix)
    oldStatus: Old state of the lock key
    newStatus: new state of the lock key
*/
function updateKey(keyname, oldStatus, newStatus) {
    if(oldStatus != newStatus) {
        let setting_mode = newStatus?'on':'off';
        
        let ico = Gio.Icon.new_for_string(setting.get_string(keyname+'-'+setting_mode+'-icon'));
        let label = setting.get_string(keyname+'-'+setting_mode+'-label');
        
        let stayVal = newStatus && setting.get_boolean(keyname+'-keep');
        //If not using the maxLevelParam, both args are set to the stay value. (last argument ignored)
        let maxLevelParam = useMaxLevel? 0 : stayVal; 
        Main.osdWindowManager.show(-1, ico, label, null, maxLevelParam, stayVal);
        
    } else return false;
}


function init(metadata) {
    enabled = false;
    useMaxLevel = (Main.osdWindowManager.setMaxLevel != null);
    Convenience.initTranslations("lock-keys-osd");
}

function enable(){
    capStatus = Keymap.get_caps_lock_state();
    numStatus = Keymap.get_num_lock_state();
    scrollStatus = Keymap.get_scroll_lock_state();
    
    global.log("[lock-keys-osd] Initialized; Caps status: " 
        + (capStatus?"On":"Off")
        + ", Num status: " 
        + (numStatus?"On":"Off")
        + ", Scroll status: "
        + (scrollStatus?"On":"Off"));
    
    _KeyStatusId = Keymap.connect('state_changed', update);
    
    //Save OsdWindowManager's functions:
    oldManagerShow = Main.osdWindowManager.show;
    oldManagerShowOsdWindow = Main.osdWindowManager._showOsdWindow;
    oldManagerMonitorsChanged = Main.osdWindowManager._monitorsChanged;
    
    //Replace OsdWindowManager's functions, to add extra show parameter:
    Main.osdWindowManager.show = newManagerShow;
    Main.osdWindowManager._showOsdWindow = newManagerShowOsdWindow;
    //Aswell as creating/destroying new OsdWindows:
    Main.osdWindowManager._monitorsChanged = newManagerMonitorsChanged;
    
    
    //Save & Replace all OsdWindows with OsdKeepWindows:
    for(let i = 0; i < Main.osdWindowManager._osdWindows.length; i++) {
        //Saves at the specific index.
        oldOsdWindows[i] =  Main.osdWindowManager._osdWindows[i];
        
        //Always creates new to replace with
        let keepWin = new OsdKeepWindow(oldOsdWindows[i]._monitorIndex);
        
        Main.osdWindowManager._osdWindows[i] = keepWin;
        
        //Copy properties:
        keepWin.copy_from(oldOsdWindows[i]);
    }
    
    update();
}


function disable(){
    Keymap.disconnect(_KeyStatusId);
    
    //Restore OsdWindowManager functions:
    Main.osdWindowManager.show = oldManagerShow;
    Main.osdWindowManager._showOsdWindow = oldManagerShowOsdWindow;
    Main.osdWindowManager._monitorsChanged = oldManagerMonitorsChanged;
    
    //Restore OsdWindows:
    for(let i = 0; i < Main.osdWindowManager._osdWindows.length; i++) {
        //Restore old one, getting rid of the keep ones.
        //Copy properties from new to old:
        let keepWin = Main.osdWindowManager._osdWindows[i]
        keepWin.copy_to(oldOsdWindows[i]);
        
        //Destroy old: so that UI changes are reverted on extension disable.
        keepWin.actor.destroy();
        
        //Replace
        Main.osdWindowManager._osdWindows[i] = oldOsdWindows[i];
    }
}
