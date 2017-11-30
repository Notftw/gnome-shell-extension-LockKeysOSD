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

const setting = Convenience.getSettings();

//detect the keyboard key press event
const Gdk = imports.gi.Gdk;
const Keymap = Gdk.Keymap.get_default();

let capStatus, numStatus, scrollStatus, _KeyStatusId, enabled;

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
        update();
    
    } else {
        global.log("[lock-keys-osd] Deactive: Unbound keys");
        Keymap.disconnect(_KeyStatusId);
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
        Main.osdWindowManager.show(-1, ico, label);
        
    }
    if(numStatus != newNumStatus) {
        let setting_mode = newNumStatus?'on':'off';
        
        let ico = Gio.Icon.new_for_string(setting.get_string('num-'+setting_mode+'-icon'));
        let label = setting.get_string('num-'+setting_mode+'-label');
        
        global.log("[lock-keys-osd] Showing Num");
        Main.osdWindowManager.show(-1, ico, label);
        
    }
    if(scrollStatus != newScrollStatus) {
        let setting_mode = newScrollStatus?'on':'off';
        
        let ico = Gio.Icon.new_for_string(setting.get_string('scroll-'+setting_mode+'-icon'));
        let label = setting.get_string('scroll-'+setting_mode+'-label');
        
        global.log("[lock-keys-osd] Showing Scroll");
        Main.osdWindowManager.show(-1, ico, label);
        
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
