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

let capStatus, numStatus, scrollStatus, _KeyStatusId;

let old_show = null, old_hide = null;

/**
 * Replacement OsdWindow.show()
 * Has to be run for all osdWindows
 * Before they run the show() command
 * To cancel the show's timeout after it it called
**/
function add_canceller(osdWindow) {
    if(old_show == null) old_show = osdWindow.show;
    
    osdWindow.show = function lock_keys_osd_show() {
        old_show.apply(osdWindow, arguments);
        Mainloop.source_remove(osdWindow._hideTimeoutId);
    }
}

//Revert the specific osdWindow to non-injected
function revert_show(osdWindows) {
    if(old_show != null)
    osdWindows.forEach(osdWindow => osdWindow.show = old_show);
    old_show = null;
}

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

/**
 * Applies injectinos for osd windows, before they are to be shown
 * So that all future show() calls have their hide timeouts cancelled
**/
function set_stay_pre() {
    Main.osdWindowManager._osdWindows.forEach(osdWindow => {
        add_canceller(osdWindow)
    });
}

/**
 * Applies injections for osd windows, after they are to be shown
 * So that all future show() calls revert the osdWindows to normal
 */
function set_stay_post() {
    revert_show(Main.osdWindowManager._osdWindows);
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
        
        if(stayVal) set_stay_pre(); //Prevent hide timeout
        
        Main.osdWindowManager.show(-1, ico, label, null, 0);
        if(stayVal) set_stay_post(-1, ico, label, null, 0); //Revert after temporary osd (_hide), uninject show()
        
    } else return false;
}


function init(metadata) {
    Convenience.initTranslations("lock-keys-osd");
}

function enable(){
    capStatus = Keymap.get_caps_lock_state();
    numStatus = Keymap.get_num_lock_state();
    scrollStatus = Keymap.get_scroll_lock_state();
    
    /*global.log("[lock-keys-osd] Initialized; Caps status: " 
        + (capStatus?"On":"Off")
        + ", Num status: " 
        + (numStatus?"On":"Off")
        + ", Scroll status: "
        + (scrollStatus?"On":"Off"));*/
    
    _KeyStatusId = Keymap.connect('state_changed', update);
    
    update();
}


function disable(){
    Keymap.disconnect(_KeyStatusId);
    revert_show(Main.osdWindowManager._osdWindows);
}
