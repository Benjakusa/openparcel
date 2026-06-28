const Service = require('node-windows').Service;
const path = require('path');
const action = process.argv[2]?.toLowerCase();

const svc = new Service({
    name: 'OpenDeskParcel',
    description: 'OpenDesk Parcel Management SaaS Backend API',
    script: path.join(__dirname, 'server.js'),
    nodeOptions: ['--harmony'],
    env: {
        name: 'NODE_ENV',
        value: process.env.NODE_ENV || 'production',
    },
    maxRetries: 3,
    wait: 2,
    grow: .5,
});

svc.on('install', () => {
    console.log('Service installed. Starting...');
    svc.start();
});

svc.on('alreadyinstalled', () => {
    console.log('Service is already installed.');
});

svc.on('start', () => console.log('Service started.'));

svc.on('stop', () => console.log('Service stopped.'));

svc.on('uninstall', () => {
    console.log('Service uninstalled.');
});

if (action === 'install') {
    svc.install();
} else if (action === 'uninstall') {
    svc.uninstall();
} else {
    console.log('Usage: node windows-service.js install|uninstall');
}
