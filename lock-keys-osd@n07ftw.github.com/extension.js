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
        
        let stayVal = newStatus && setting.get_boolean(keyname+'-keep'); //TODO: use stayVal
        Main.osdWindowManager.show(-1, ico, label, null, 0);
        
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
}
