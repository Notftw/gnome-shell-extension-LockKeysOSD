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

var Row_Widget_Width_Request=  168;

//List of files NOT to show before inital show_all call.
//This will be null after show_call called.
let no_shows = [];

//Returns an icon widget, i.e. a box, with a switch
//that controls a button/entry below with the icon
function CreateIconWidget() {
    let ChooserButton, NameEntry;
    
    let stateSwitcher = function(FileSwitch, state) {
        let to_hide = (state)?NameEntry:ChooserButton;
        let to_show = (state)?ChooserButton:NameEntry;
        
        if(no_shows != null) {
            if(no_shows.indexOf(to_hide) < 0)
                no_shows.push(to_hide);
            
            let ind = no_shows.indexOf(to_show)
            if(ind >= 0)
                no_shows.splice(ind, 1);
        }
        
        to_hide.hide();
        to_show.show();
    }
    
    let MainBox = new Gtk.Box({orientation:Gtk.Orientation.VERTICAL});
    MainBox.spacing = 4;
    
        let ComboBox = new Gtk.Box({orientation:Gtk.Orientation.HORIZONTAL});
        MainBox.pack_start(ComboBox, false, false, 0);
        ComboBox.spacing = 8;
        
            let SwitchLabel = new Gtk.Label();
            ComboBox.pack_start(SwitchLabel, false, false, 0);
            SwitchLabel.get_style_context().add_class("dim-label");
            SwitchLabel.label = "Custom file";
            
            let FileSwitch = new Gtk.Switch();
            ComboBox.pack_start(FileSwitch, false, false, 0);
            FileSwitch.connect("state-set", stateSwitcher);
        
        let WidgetBox = new Gtk.Box({orientation:Gtk.Orientation.HORIZONTAL});
        MainBox.pack_end(WidgetBox, false, false, 0);
            
            ChooserButton = new Gtk.FileChooserButton({
                title:"Open an Icon",
                action:Gtk.FileChooserAction.OPEN
            });
            WidgetBox.pack_start(ChooserButton, true, true, 0);
            let Filter = new Gtk.FileFilter();
            Filter.set_name("Icon");
            Filter.add_pixbuf_formats();
            ChooserButton.add_filter(Filter);
            
            NameEntry = new Gtk.Entry();
            WidgetBox.pack_start(NameEntry, true, true, 0);
    
    stateSwitcher(FileSwitch);
    
    MainBox.icon_widget_toggle = FileSwitch;
    MainBox.icon_widget_name = NameEntry;
    MainBox.icon_widget_file = ChooserButton;
    return MainBox;
}

//Returns a function used for NewPrefsWidget rows make_widget.
//that creates a label that is attached to that setting
function CreateTextSettingWidgetCreator(setting_name) {
    return function() {
        let TextWidget = new Gtk.Entry();
        TextWidget.valign = Gtk.Align.CENTER;
        TextWidget.halign = Gtk.Align.END;
        
        TextWidget.connect('changed', function(TextWidget) {
            setting.set_string(setting_name, TextWidget.text);
        });
        TextWidget.text = setting.get_string(setting_name);
        return TextWidget;
    };
}

function CreateTextSettingWidgetResetter(setting_name) {
    return function(TextWidget) {
        TextWidget.text = setting.get_default_value(setting_name).deep_unpack();
    }
}

function CreateIconSettingWidgetCreator(setting_name) {
    function is_file() {
        return Gio.file_new_for_path(setting.get_string(setting_name)).
            query_exists(new Gio.Cancellable());
    }
    
    return function() {
        var Widget = CreateIconWidget();
        Widget.icon_widget_toggle.set_state(is_file());
        
        Widget.icon_widget_name.text = setting.get_string(setting_name);
        
        Widget.icon_widget_name.connect('changed', function(TextWidget) {
            global.log("[lock-keys-osd] Set from entry: " + TextWidget.text);
            setting.set_string(setting_name, TextWidget.text);
        });
        
        Widget.icon_widget_file.connect('file-set', function(Chooser) {
            global.log("[lock-keys-osd] Set from chooser: "	+ Chooser.get_filename());
            setting.set_string(setting_name, Chooser.get_filename());
            Widget.icon_widget_name.text = Chooser.get_filename();
        });
        return Widget;
    };
}

function CreateIconSettingWidgetResetter(setting_name) {
    let is_file = Gio.file_new_for_path(
            setting.get_default_value(setting_name).deep_unpack()).
        query_exists(new Gio.Cancellable());
    
    return function(Widget) {
        Widget.icon_widget_toggle.set_state(is_file);
        
        Widget.icon_widget_name.text = setting.get_default_value(setting_name).deep_unpack();
    };
}

const NewPrefsWidget = new GObject.Class({
    Name:'LockKeysOSD.Prefs.Widget',
    GTypeName:'NewPrefsWidget',
    Extends:Gtk.Box,
    _init:function(params) {
        this.parent(params);
        
        this.orientation = Gtk.Orientation.VERTICAL;
        this.borderWidth = 20;
        this.spacing = 12; //TODO: Eliminate extra space above stack
        
        this.marginLeft = 40;
        this.marginRight = 40;
        
        let SwitcherBox = new Gtk.Box({orientation:Gtk.Orientation.HORIZONTAL});
        this.add(SwitcherBox);
        
        let Switcher = new Gtk.StackSwitcher();
        SwitcherBox.pack_start(Switcher, true, false, 0);
        Switcher.halign = Gtk.Align.CENTER;
        
        let stack = new Gtk.Stack();
        this.add(stack);
        Switcher.set_stack(stack);
        
        stack.set_transition_duration(300);
        stack.set_transition_type(Gtk.StackTransitionType.SLIDE_LEFT_RIGHT);
        
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
        
        let AllResetFuncs = [];
        
        for(let i = 0; i < lockers.length; i++) {
            let key = lockers[i];
            
            let rows = [
                {
                    label:"Text turning OFF",
                    desc:"What text to show on OSD when key is locked",
                    make_widget:CreateTextSettingWidgetCreator(key.setting + '-on-label'),
                    resetter:CreateTextSettingWidgetResetter(key.setting + '-on-label'),
                    set_width:true,
                },
                {
                    label:"Text turning ON",
                    desc:"What text to show on OSD when key is unlocked",
                    make_widget:CreateTextSettingWidgetCreator(key.setting + '-off-label'),
                    resetter:CreateTextSettingWidgetResetter(key.setting + '-off-label'),
                    set_width:true,
                },
                {
                    label:"Icon turning ON",
                    desc:"Icon name/file to show on OSD when key is locked",
                    make_widget:CreateIconSettingWidgetCreator(key.setting + '-on-icon'),
                    resetter:CreateIconSettingWidgetResetter(key.setting + '-on-icon'),
                    set_width:true,
                },
                {
                    label:"Icon turning OFF",
                    desc:"Icon name/file to show on OSD when key is unlocked",
                    make_widget:CreateIconSettingWidgetCreator(key.setting + '-off-icon'),
                    resetter:CreateIconSettingWidgetResetter(key.setting + '-off-icon'),
                    set_width:true,
                },
                {
                    label:"Keep on-screen",
                    desc:"Keeps the OSD visible when key is locked",
                    make_widget:function() {
                        let KeepSwitch = new Gtk.Switch();
                        
                        KeepSwitch.state = setting.get_boolean(key.setting + '-keep');
                        KeepSwitch.valign = Gtk.Align.CENTER;
                        
                        KeepSwitch.connect("state-set", function(KeepSwitch, state) {
                            setting.set_boolean(key.setting + '-keep', state);
                        });
                        return KeepSwitch;
                    },
                    resetter:function(KeepSwitch) {
                        
                        KeepSwitch.state = setting.get_default_value(key.setting + '-keep').deep_unpack();
                    },
                    set_width:false,
                }
            ];
            
            //List of functions to use to reset.
            let ResetList = [];
            
            //Indented according to GUI's nesting:
            
            let outBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL});
            stack.add_titled(outBox, key.setting, key.label);
            
            //this.set_tab_label_text(outBox, key.label);4
                
                let frame = new Gtk.Frame();
                outBox.pack_start(frame, true, false, 10);
                frame.set_label(null);
                    
                    let listBox = new Gtk.ListBox();
                    frame.add(listBox);
                    listBox.selection_mode = Gtk.SelectionMode.GTK_SELECTION_NONE;
                    listBox.avtivatable = true;
                        
                        for(let r = 0; r < rows.length; r++) {
                            let row = rows[r];
                            
                            let TextRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, margin:0});
                            listBox.add(TextRow);
                            TextRow.borderWidth = 16;
                            TextRow.spacing = 16;
                            
                                let LabelBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL});
                                TextRow.pack_start(LabelBox, false, false, 0);
                                LabelBox.halign = Gtk.Align.START;
                                
                                    let TextLabel= new Gtk.Label();
                                    TextLabel.label = row.label;
                                    LabelBox.pack_start(TextLabel, false, false, 0);
                                    TextLabel.halign = Gtk.Align.START;
                                        
                                    if(row.desc != null) {
                                        let TextDesc = new Gtk.Label();
                                        TextDesc.label = row.desc;
                                        LabelBox.pack_start(TextDesc, false, false, 0);
                                        TextDesc.get_style_context().add_class("dim-label")
                                        TextDesc.halign = Gtk.Align.START;
                                    }
                                
                                let ResetButton = new Gtk.Button();
                                TextRow.pack_end(ResetButton, false, false, 0);
                                ResetButton.label = "Reset"
                                ResetButton.valign = Gtk.Align.CENTER;
                                
                                let TextWidget = row.make_widget();
                                TextRow.pack_end(TextWidget, false, false, 0);
                                TextWidget.halign = Gtk.Align.CENTER;
                                if(row.set_width)
                                    TextWidget.width_request = Row_Widget_Width_Request;
                                
                                let ResetFunc = function() {
                                    row.resetter(TextWidget);
                                };
                                
                                if(row.resetter != null) {
                                    ResetButton.connect('clicked', ResetFunc);
                                    ResetList.push(ResetFunc);
                                    AllResetFuncs.push(ResetFunc);
                                } else
                                    ResetButton.sensitive = false;
                        }
                
                let ResetAll = new Gtk.Button();
                outBox.pack_start(ResetAll, false, false, 0);
                ResetAll.label = "Reset All";
                ResetAll.get_style_context().add_class("destructive-action");
                ResetAll.connect('clicked', function() {
                    for(let r = 0; r < ResetList.length; r++)
                        ResetList[r]();
                });
                ResetAll.halign = Gtk.Align.END;
        }
        
        let ResetAll = new Gtk.Button();
        SwitcherBox.pack_end(ResetAll, false, false, 0);
        ResetAll.label = "Reset All Keys";
        ResetAll.get_style_context().add_class("destructive-action");
        ResetAll.connect('clicked', function() {
            for(let r = 0; r < AllResetFuncs.length; r++)
                AllResetFuncs[r]();
        });
        ResetAll.show();
        
    }
});

function buildPrefsWidget(){
    let widget = new NewPrefsWidget();

    widget.show_all();
    for(let i = 0; i < no_shows.length; i++) {
        global.log("Not showing " + no_shows[i]);
        no_shows[i].hide();
    }
    
    no_shows = null;

    return widget;
}
