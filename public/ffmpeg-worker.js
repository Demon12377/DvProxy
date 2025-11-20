
importScripts("https://unpkg.com/@ffmpeg/ffmpeg@0.11.0/dist/ffmpeg.min.js");

self.onmessage = async (event) => {
  const { createFFmpeg, fetchFile } = FFmpeg;
  const ffmpeg = createFFmpeg({
    log: true,
    corePath: "https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js",
  });

  const { image, audio, duration } = event.data;

  await ffmpeg.load();

  ffmpeg.FS("writeFile", "image.jpg", await fetchFile(image));
  ffmpeg.FS("writeFile", "audio.mp3", await fetchFile(audio));

  await ffmpeg.run(
    "-loop", "1",
    "-i", "image.jpg",
    "-i", "audio.mp3",
    "-c:v", "libx264",
    "-tune", "stillimage",
    "-c:a", "aac",
    "-b:a", "192k",
    "-pix_fmt", "yuv420p",
    "-shortest",
    "output.mp4"
  );

  const data = ffmpeg.FS("readFile", "output.mp4");

  self.postMessage({ data: new Uint8Array(data.buffer) });
};
