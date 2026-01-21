const http = require('http');

http.get('http://localhost:3002/sectores', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('Data:', data);
    });
}).on('error', (err) => {
    console.log('Error:', err.message);
});
