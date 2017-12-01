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

function init(){
    Convenience.initTranslations('lock-keys-osd');
}

const KeysPrefsWidget = new GObject.Class({
    Name: 'KeysIndicator.Prefs.Widget',
    GTypeName: 'KeysPrefsWidget',
    Extends: Gtk.Box,

    _init: function(params) {
        this.parent(params);
        this.set_orientation(Gtk.Orientation.VERTICAL);

        let lockers = 
        [
            {
                label:"Caps lock",
                setting:"caps",
            },
            {
                label:"Scroll lock",
                setting:"scroll",
            },
            {
                label:"Num lock",
                setting:"num",
            }
        ];
        for(let i = 0; i < lockers.length; i++) {
            let key = lockers[i];
            let modes = [
                {
                    label:'On Icon',
                    setting:'on-icon',
                },
                {
                    label:'Off Icon',
                    setting:'off-icon',
                },
                {
                    label:'On Label',
                    setting:'on-label',
                },
                {
                    label:'Off Label',
                    setting:'off-label',
                }
            ];
            
            for(let j = 0; j < modes.length; j++) {
                let mode = modes[j];
                let setting_text = key.setting + "-" + mode.setting;
                let label_text = key.label + " " + mode.label;
                
                let Box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, margin: 10});
                let Label = new Gtk.Label({label:_(label_text), xalign:0});
                
                let Widget = new Gtk.Entry();
                Widget.text = setting.get_string(setting_text);
                
                
                (function(this_setting_name) { //Needs a new scope (probably)
                    Widget.connect('changed', function(Widget) {
                        setting.set_string(this_setting_name, Widget.text);
                    });
                })(setting_text);

                Box.pack_start(Label, true, true, 0);
                Box.add(Widget);
                this.add(Box);
            }
            
            let KeepBox = new Gtk.Box({orientation:Gtk.Orientation.HORIZONTAL, margin:10});
            let KeepLabel = new Gtk.Label({label:_("Keep "+key.label+" showing when on"), xalign:0});
            
            let KeepSwitch = new Gtk.Switch();
            KeepSwitch.connect("state-set", function(KeepSwitch, state) {
                setting.set_boolean(key.setting + '-keep', state);
            });
            KeepSwitch.state = setting.get_boolean(key.setting+'-keep');
            
            KeepBox.pack_start(KeepLabel, true, true, 0);
            KeepBox.add(KeepSwitch);
            this.add(KeepBox);
        }
    },
});


function buildPrefsWidget(){
    let widget = new KeysPrefsWidget(); 

    widget.show_all();

    return widget;
}
