const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SOUNDS_DIR = path.join(__dirname, '..', 'assets', 'sounds');

const REMINDER_SONGS = [
  { id: 'song1', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 'song2', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: 'song3', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { id: 'song4', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  { id: 'song5', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
];

async function main() {
  console.log('Starting sound download and conversion script...');
  
  if (!fs.existsSync(SOUNDS_DIR)) {
    console.log(`Creating directory: ${SOUNDS_DIR}`);
    fs.mkdirSync(SOUNDS_DIR, { recursive: true });
  }

  // Clean up any old wav files
  for (const song of REMINDER_SONGS) {
    const oldWavPath = path.join(SOUNDS_DIR, `${song.id}.wav`);
    if (fs.existsSync(oldWavPath)) {
      console.log(`Deleting obsolete wav file: ${oldWavPath}`);
      fs.unlinkSync(oldWavPath);
    }
  }

  for (const song of REMINDER_SONGS) {
    const targetPath = path.join(SOUNDS_DIR, `${song.id}.ogg`);
    console.log(`\nProcessing ${song.id}...`);
    console.log(`URL: ${song.url}`);
    console.log(`Target: ${targetPath}`);

    try {
      // Use ffmpeg to stream directly from the URL, trim to 10 seconds, and encode as standard OGG Vorbis
      // -y overwrites existing file
      // -i is the input URL
      // -t 10 limits the duration to 10 seconds
      // -c:a libvorbis encodes using the Vorbis audio codec
      // -q:a 2 sets audio quality level (medium-low, extremely space efficient)
      const command = `ffmpeg -y -i "${song.url}" -t 10 -c:a libvorbis -q:a 2 "${targetPath}"`;
      console.log(`Running: ${command}`);
      
      execSync(command, { stdio: 'inherit' });
      console.log(`Successfully generated: ${song.id}.ogg`);
    } catch (err) {
      console.error(`Error processing ${song.id}:`, err.message);
      process.exit(1);
    }
  }

  console.log('\nAll custom notification sounds successfully processed and saved as tiny OGGs!');
}

main();
