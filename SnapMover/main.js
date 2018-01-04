// ==========================================================================
// MAIN
// ==========================================================================

const {
	app,
	Tray,
	Menu,
	BrowserWindow
} = require('electron');

const modules = {
	cache: {},
	fs: require('fs'),
	path: require('path'),
	electron: require('electron'),
	storage: require('electron-json-storage'),
	watch: require('node-watch')
};

const package = require(modules.path.join(__dirname, 'package.json'));

//==========================================================================
// MAIN - EXCEPTIONS
//==========================================================================

let exception = function(err) {
	
	var err = err || 'Uncaught exception!';
	
	console.log('uncaughtException', err);
	
};

process.on('uncaughtException', exception);

// ==========================================================================
// MAIN - DEFAULTS
// ==========================================================================

global.defaults = {
	debug: false,
	title: package.name || 'Application',
	cahce: Date.now(),
	logo: modules.path.join(__dirname, 'assets/icons/png', 'logo.png'),
	logos: {
		'16': modules.path.join(__dirname, 'assets/icons/png', '16x16.png'),
		'64': modules.path.join(__dirname, 'assets/icons/png', '64x64.png')
	},
	backgroundColor: '#333'
};

// ==========================================================================
// MAIN - PLATFORM SPECIFIC
// ==========================================================================

switch (process.platform) {
	
	case 'win32':
	
		break;
	
	case 'darwin':
	
		app.dock.hide();
		
		app.dock.setIcon(global.defaults.logos['64']);
		
		break;
	
	case 'linux':
	
		break;
    
}

// ==========================================================================
// MAIN - API
// ==========================================================================

global.api = {current: {}};

// ==========================================================================
// MAIN - TRAY
// ==========================================================================

const tray = {
	instance: null,
	tooltip: global.defaults.title,
	list: {
		main: {
			label: global.defaults.title,
			click: function() {

				windows.show('main');
				
			}
		},
		quit: {
			label: 'Quit',
			accelerator: 'Command+Q',
			selector: 'terminate:'
		}
	}
};

tray.init = function() {
	
	tray.instance = new Tray(global.defaults.logos['16']);
	
	if (tray.tooltip) tray.instance.setToolTip(tray.tooltip);
	
	var items = [];
	
	for (var id in tray.list) items.push(tray.list[id]);
	
	let m = Menu.buildFromTemplate(items);
	
	tray.instance.setContextMenu(m);
	
	app.dock.setMenu(m);

};

// ==========================================================================
// MAIN - WINDOWS
// ==========================================================================

const windows = {
	list: {
		main: {
			instance: null,
			template: 'file://' + __dirname + '/index.html',
			options: {
				width: 600,
				height: 420,
				minWidth: 420,
				minHeight: 420,
				titleBarStyle: 'hiddenInset',
				show: false,
				backgroundColor: global.defaults.backgroundColor,
				icon: global.defaults.logo,
				webPreferences: {
					plugins: true,
					zoomFactor: 1.25,
					textAreasAreResizable: false,
					scrollBounce: true
				}
			}
		}
	}
};

// ==========================================================================
// MAIN - WINDOWS - SHOW
// ==========================================================================

windows.show = function(id = null) {

	if (!id || !windows.list[id]) return;

	let ref = windows.list[id];

	if (ref.instance) return ref.instance.focus();

	let options = ref.options ? ref.options : {};

	ref.instance = new BrowserWindow(options);

	ref.instance.which = id;

	ref.instance.loadURL(ref.template);

	ref.instance.on('closed', function() {
		
		windows.list[this.which].instance = null;

	});

	ref.instance.once('ready-to-show', (a) => {
		
		windows.list[a.sender.which].instance.show();
		
        if (
        	global.defaults.debug
        ) windows.list[a.sender.which].instance.toggleDevTools();

	});

};

// ==========================================================================
// MAIN - WINDOWS - ACTIVATE
// ==========================================================================

app.on('activate', function() {
	
	windows.show('main');
	
});

// ==========================================================================
// MAIN - WINDOWS - CLOSED
// ==========================================================================

app.on('window-all-closed', function() {});

// ==========================================================================
// MAIN - READY
// ==========================================================================

app.on('ready', function() {
	
	tray.init();
	
	global.api.watch();
	
	modules.storage.get('current', function(err, doc) {
		
		if (
			!doc.source
			|| !doc.target
		) windows.show('main');
		
	});

});

// ==========================================================================
// MAIN - API - WATCH
// ==========================================================================

global.api.watcher = null;

global.api.watch = function(options = null, callback = function() {}) {
	
	modules.storage.get('current', function(err, doc) {
		
		let dir = doc.source || null;
		
		if (global.api.watcher) global.api.watcher.close();
		
		global.api.watcher = dir ? modules.watch(dir, {
			recursive: false
		}, function(e, name) {
			
			if (e === 'update') try {
				
				global.api.move(name.split('/').splice(-1)[0]);
				
			} catch(err) {};
			
		}) : null;
		
	});

};

// ==========================================================================
// MAIN - API - MOVE
// ==========================================================================

global.api.move = function(file = null, callback = function() {}) {
	
	if (
		!file
		|| !global.api.current
		|| !global.api.current.source
		|| !global.api.current.target
	) return callback();
	
	if (
		(file.indexOf('Screen Shot ') === 0 || file.indexOf('Screenshot ') === 0)
		&& file.indexOf('.png') > -1
	) modules.fs.rename(
		[global.api.current.source, file].join('/'),
		[global.api.current.target, file].join('/')
	, function(r) {});
	
	callback();
	
};

// ==========================================================================
// MAIN - API - GET
// ==========================================================================

global.api.get = function(options = null, callback = function() {}) {
	
	modules.storage.get('current', function(err, doc) {
		
		global.api.current = doc;
	
		callback(global.api.current);
		
	});
	
};

// ==========================================================================
// MAIN - API - SET
// ==========================================================================

global.api.set = function(options = null, callback = function() {}) {
	
	if (!options.source) options.source = global.api.current.source;
	if (!options.target) options.target = global.api.current.target;
	
	if (
		options.target
		&& options.source == options.target
	) options.target = null;
	
	global.api.current = options;
	
	modules.storage.set('current', options, function() {
		
		global.api.watch();
					
		callback(global.api.current);
		
	});

};

// ==========================================================================
// MAIN - API - SYNC
// ==========================================================================

global.api.sync = function(options = null, callback = function() {}) {
	
	modules.storage.get('current', function(err, doc) {
		
		global.api.current = doc;
		
		if (
			global.api.current
			&& global.api.current.source
			&& global.api.current.target
		) return (function() {
			
			modules.fs.readdir(global.api.current.source, function(err, items) {
				
				for (i = 0; i < items.length; i++) global.api.move(items[i]);
				
				callback({memo: 'Checking ' + items.length + ' files(s).'});
				
			});
			
		})();
		
		callback({memo: 'Check your source and target. Something is wrong.'});

	});
	
};