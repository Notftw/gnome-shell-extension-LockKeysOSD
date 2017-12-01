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

//Non-Keep windows that have been replaced by Keep windows.
//in the Main.osdWindowManager._osdWindows.
var oldOsdWindows = [];

var oldManagerShow, oldManagerShowOsdWindow

function newManagerShow(monitorIndex, icon, label, level, stay) {
    global.log("[lock-keys-osd] Custom manager show(stay="+stay+")");
    if (monitorIndex != -1) {
        for (let i = 0; i < this._osdWindows.length; i++) {
            if (i == monitorIndex)
                this._showOsdWindow(i, icon, label, level, stay);
            else
                this._osdWindows[i].cancel();
        }
    } else {
        for (let i = 0; i < this._osdWindows.length; i++)
            this._showOsdWindow(i, icon, label, level, stay);
    }
}

function newManagerShowOsdWindow(monitorIndex, icon, label, level, stay) {
    global.log("[lock-keys-osd] Custom manager _showOsdWindow(stay="+stay+")");
    this._osdWindows[monitorIndex].setIcon(icon);
    this._osdWindows[monitorIndex].setLabel(label);
    this._osdWindows[monitorIndex].setLevel(level);
    this._osdWindows[monitorIndex].show(stay);
}

//When the extension runs, we replace Main.osdWindowManager._osdWindows
//elements with this:
var OsdKeepWindow = Lang.Class({
    Name:'OsdKeepWindow',
    Extends:osdWindow.OsdWindow,
    _init:function OsdKeepWindow(monitorIndex) {
        this.parent(monitorIndex);
        global.log("[lock-keys-osd] Initing a custom keeper window with index " + monitorIndex);
        this.staying = false; //Current state, shown or hidden.
    },
    
    //For when the extension turns on & off:
    //This handles keeping the OSDs turned on for a bit (a bit longer)
    //Copy a non-keep OSD, hiding it
    handoff_from:function(osdWindow) {
        global.log("[lock-keys-osd] Copying "
            +(osdWindow._hideTimeoutId?"shown":"hidden")+" to new " + this._monitorIndex);
        
        //Copy properties:
        this.setLabel(osdWindow._label.text);
        this.setIcon(osdWindow._icon.gicon);
        if(osdWindow._level.actor.visible)
            this.setLevel(osdWindow._level.level);
        else
            this.setLevel();
        
        
        this._hideTimeoutId = osdWindow._hideTimeoutId
        
        //If the old one is shown:
        if(osdWindow._hideTimeoutId) {
            //Disale old window's timer:
            Mainloop.source_remove(osdWindow._hideTimeoutId);
            this._hideTimeoutId = 0;
            
            //And enable our window, for a time.:
            this._setTimer(false);
        }
        //Hides the old window instantly:
        osdWindow._reset();
    },
    
    //Reverse of from: Copies THIS OSD to the given one,
    //Hiding this and showing that.
    handoff_to:function(osdWindow) {
        global.log("[lock-keys-osd] Copying "
            +(this._hideTimeoutId?"shown":"hidden")+" to new " + this._monitorIndex);
        
        //Copy properties from widget:
        osdWindow.setLabel(this._label.text);
        osdWindow.setIcon(this._icon.gicon);
        if(this._level.actor.visible)
            osdWindow.setLevel(this._level.level);
        else
            osdWindow.setLevel();
        
        
        osdWindow.hideTimeoutId = this.hideTimeoutId;
        
        //If this old one is shown:
        if(osdWindow._hideTimeoutId)
            Mainloop.source_remove(osdWindow._hideTimeoutId);
        
        if(osdWindow._hideTimeoutId || this.staying) {
            //Disable this old one's timer (if it has one)
            if(osdWindow._hideTimeoutId)
                Mainloop.source_remove(this._hideTimeoutId);
            
            this._hideTimeoutId = 0;
            
            this.staying = false;
            
            //Show the new one:
            //BUT we need a new timeout
            //setTimer will set timer on osdWindow
            this._setTimer.call(osdWindow, false);
        } 
        //Hides this old one instantly:
        this._reset();
    },
    
    show: function(stay) {
        if(!stay) stay = false;
        global.log("[lock-keys-osd] Showing a custom keeper window. Stay: " + stay +". " + this._monitorIndex);
        if (!this._icon.gicon)
            return;

        if (!this.actor.visible) {
            Meta.disable_unredirect_for_screen(global.screen);
            this.actor.opacity = 0;
            this.actor.get_parent().set_child_above_sibling(this.actor, null);

            Tweener.addTween(this.actor,
                             { opacity: 255,
                               time: FADE_TIME,
                               transition: 'easeOutQuad' });
           
        }
       this._setTimer(stay);
    },
    //Does the timing stuff, if !this._stay 
    _setTimer:function(stay) {
        global.log("[lock-keys-osd] setting timeout timer on " 
            + this.constructor.name + ", " + this._monitorIndex + ", stay: " + stay);
        
        
        if (this._hideTimeoutId)
            Mainloop.source_remove(this._hideTimeoutId);
        
        if(!stay) {
            this._hideTimeoutId = Mainloop.timeout_add(HIDE_TIMEOUT,
                                                       Lang.bind(this, this._hide));
            GLib.Source.set_name_by_id(this._hideTimeoutId, '[gnome-shell] this._hide');
        }
        this.actor.show();
        this.actor.opacity = 255;
    },
    
    cancel: function() {
        global.log("[lock-keys-osd] cancelling " + this._monitorIndex);
        if (this._hideTimeoutId)
            Mainloop.source_remove(this._hideTimeoutId);
            
        this._hide();
    },

    _hide: function() {
        global.log("[lock-keys-osd] hiding " + this._monitorIndex);
        this._hideTimeoutId = 0;
        Tweener.addTween(this.actor,
                         { opacity: 0,
                           time: FADE_TIME,
                           transition: 'easeOutQuad',
                           onComplete: Lang.bind(this, function() {
                              this._reset();
                              Meta.enable_unredirect_for_screen(global.screen);
                           })
                         });
        this.staying = false;
        return GLib.SOURCE_REMOVE;
    },
});

function setActive(enable){
    if (enable){
        global.log("[lock-keys-osd] Active: Bound keys, initialized states.");
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
        
        //Replace Manager's functions:
        oldManagerShow = Main.osdWindowManager.show;
        Main.osdWindowManager.show = newManagerShow;
        oldManagerShowOsdWindow = Main.osdWindowManager._showOsdWindow;
        Main.osdWindowManager._showOsdWindow = newManagerShowOsdWindow;
        
        //Now replace all osdWindows
        for(let i = 0; i < Main.osdWindowManager._osdWindows.length; i++) {
            //Save old one:
            global.log("[lock-keys-osd] Replacing osdWindow "+i+" with custom keeper windows");
            oldOsdWindows[i] =  Main.osdWindowManager._osdWindows[i];
            
            //Replace with new one
            Main.osdWindowManager._osdWindows[i] = 
                new OsdKeepWindow(oldOsdWindows[i]._monitorIndex);
            //Copy properties:
            Main.osdWindowManager._osdWindows[i].handoff_from(oldOsdWindows[i]);
            
            log(Main.osdWindowManager._osdWindows[i]);
        }
        
        update();
        
    } else {
        global.log("[lock-keys-osd] Deactive: Unbound keys");
        Keymap.disconnect(_KeyStatusId);
        
        //Restore Manager functions:
        Main.osdWindowManager.show = oldManagerShow;
        Main.osdWindowManager._showOsdWindow = oldManagerShowOsdWindow;
        
        //Restore osd windows:
        for(let i = 0; i < Main.osdWindowManager._osdWindows.length; i++) {
            //Restore old one, getting rid of the keep ones.
            global.log("[lock-keys-osd] Replacing keeper window "+i+" with old windows");
            //Copy properties
            Main.osdWindowManager._osdWindows[i].handoff_to(oldOsdWindows[i]);
            //Replace
            Main.osdWindowManager._osdWindows[i] = oldOsdWindows[i];
        }
    }
}
    
//Equivalent to old _popupStyle or _grayoutStyle
//But since there's no style, name is changed.
function update() {
    let newCapStatus = Keymap.get_caps_lock_state();
    let newNumStatus = Keymap.get_num_lock_state();
    let newScrollStatus = Keymap.get_scroll_lock_state();
    
    if(capStatus != newCapStatus) {
        let setting_mode = newCapStatus?'on':'off';
        
        let ico = Gio.Icon.new_for_string(setting.get_string('caps-'+setting_mode+'-icon'));
        let label = setting.get_string('caps-'+setting_mode+'-label');
        
        global.log("[lock-keys-osd] Showing Caps");
        Main.osdWindowManager.show(-1, ico, label, null, newCapStatus);
        
    } else
    if(numStatus != newNumStatus) {
        let setting_mode = newNumStatus?'on':'off';
        
        let ico = Gio.Icon.new_for_string(setting.get_string('num-'+setting_mode+'-icon'));
        let label = setting.get_string('num-'+setting_mode+'-label');
        
        global.log("[lock-keys-osd] Showing Num");
        Main.osdWindowManager.show(-1, ico, label, null, newNumStatus);
        
    } else
    if(scrollStatus != newScrollStatus) {
        let setting_mode = newScrollStatus?'on':'off';
        
        let ico = Gio.Icon.new_for_string(setting.get_string('scroll-'+setting_mode+'-icon'));
        let label = setting.get_string('scroll-'+setting_mode+'-label');
        
        global.log("[lock-keys-osd] Showing Scroll");
        Main.osdWindowManager.show(-1, ico, label, null, newScrollStatus);
        
    }
    
    capStatus = newCapStatus;
    numStatus = newNumStatus;
    scrollStatus = newScrollStatus;
}


function init(metadata) {
    enabled = false;
    Convenience.initTranslations("lock-keys-osd");
}

function enable(){
    //global.log("[lock-keys-osd] Enabled");
    
    setActive(true);
}


function disable(){
    //global.log("[lock-keys-osd] Disabled");
    
    setActive(false);
}
