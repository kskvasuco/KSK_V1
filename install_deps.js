const { execSync } = require('child_process');
try {
    console.log('Starting npm install in client...');
    execSync('npm install recharts lucide-react', { cwd: './client', stdio: 'inherit' });
    console.log('Installation successful!');
} catch (err) {
    console.error('Installation failed:', err.message);
    process.exit(1);
}
