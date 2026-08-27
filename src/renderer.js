/**
 * Desktop Renderer Module
 * Handles local video rendering using FFmpeg with hardware acceleration
 */

const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const path = require('path');
const fs = require('fs');
const os = require('os');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

class DesktopRenderer {
  constructor(settings = {}) {
    this.outputDir = settings.outputDir || path.join(os.homedir(), 'Videos', 'Jutoka');
    this.quality = settings.quality || 'high';
    this.hardwareAccel = settings.hardwareAccel !== false;
    this.queue = [];
    this.activeJob = null;
    this.callbacks = {};
  }

  on(event, callback) {
    this.callbacks[event] = callback;
  }

  emit(event, data) {
    if (this.callbacks[event]) this.callbacks[event](data);
  }

  getQualitySettings(quality) {
    const presets = {
      '4k': { bitrate: '8000k', resolution: '3840x2160', crf: 18 },
      'high': { bitrate: '4000k', resolution: '1920x1080', crf: 20 },
      'medium': { bitrate: '2000k', resolution: '1280x720', crf: 23 },
      'low': { bitrate: '1000k', resolution: '854x480', crf: 26 },
    };
    return presets[quality] || presets.high;
  }

  async probeMedia(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }

  async renderVideo(job) {
    const q = this.getQualitySettings(this.quality);
    const outputDir = this.outputDir;
    fs.mkdirSync(outputDir, { recursive: true });

    const timestamp = Date.now();
    const outputName = `${job.name || 'render'}_${timestamp}.mp4`;
    const outputPath = path.join(outputDir, outputName);

    return new Promise((resolve, reject) => {
      const cmd = ffmpeg();

      // Add inputs
      if (job.imageUrl) {
        cmd.input(job.imageUrl);
        cmd.inputOptions(['-loop 1', '-framerate 30']);
      }
      if (job.videoUrl) cmd.input(job.videoUrl);
      if (job.audioUrl) cmd.input(job.audioUrl);

      // Video encoding options
      const outputOptions = [
        '-c:v', 'libx264',
        '-preset', this.hardwareAccel ? 'fast' : 'medium',
        '-b:v', q.bitrate,
        '-maxrate', q.bitrate,
        '-bufsize', `${parseInt(q.bitrate) * 2}k`,
        '-s', q.resolution,
        '-pix_fmt', 'yuv420p',
        '-r', '30',
        '-movflags', '+faststart',
      ];

      // Audio options
      if (job.audioUrl) {
        outputOptions.push('-c:a', 'aac', '-b:a', '192k');
      }

      // Duration limit if specified
      if (job.duration) {
        outputOptions.push('-t', String(job.duration));
      }

      // Map streams
      if (job.imageUrl && job.audioUrl) {
        outputOptions.push('-map', '0:v:0', '-map', '1:a:0');
        outputOptions.push('-shortest');
      } else if (job.videoUrl && job.audioUrl) {
        outputOptions.push('-map', '0:v:0', '-map', '1:a:0');
      }

      cmd.outputOptions(outputOptions)
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('[Jutoka Desktop] Render started:', commandLine);
          this.emit('start', { job, commandLine });
        })
        .on('progress', (progress) => {
          const percent = Math.min(100, Math.round(progress.percent || 0));
          this.emit('progress', { job, percent, timemark: progress.timemark });
        })
        .on('end', () => {
          console.log('[Jutoka Desktop] Render complete:', outputPath);
          this.emit('complete', { job, outputPath });
          resolve({ outputPath, fileName: outputName });
        })
        .on('error', (err) => {
          console.error('[Jutoka Desktop] Render error:', err.message);
          this.emit('error', { job, error: err.message });
          reject(err);
        })
        .run();
    });
  }

  async renderWithOverlays(job) {
    // Advanced rendering with image overlays, text, and waveform
    const q = this.getQualitySettings(this.quality);
    const outputDir = this.outputDir;
    fs.mkdirSync(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, `${job.name || 'render'}_${Date.now()}.mp4`);

    return new Promise((resolve, reject) => {
      const cmd = ffmpeg();

      if (job.imageUrl) cmd.input(job.imageUrl).inputOptions(['-loop 1', '-framerate 30']);
      if (job.audioUrl) cmd.input(job.audioUrl);

      const filters = [];

      // Scale and pad image to target resolution
      if (job.imageUrl) {
        filters.push(`scale=${q.resolution.split('x')[0]}:${q.resolution.split('x')[1]}:force_original_aspect_ratio=decrease`);
        filters.push(`pad=${q.resolution.split('x')[0]}:${q.resolution.split('x')[1]}:(ow-iw)/2:(oh-ih)/2:color=white`);
      }

      // Apply zoom/pan effect if specified
      if (job.zoomEffect) {
        filters.push(`zoompan=z='min(zoom+0.0015,1.5)':d=300:s=${q.resolution}`);
      }

      // Apply fade in/out
      if (job.fadeIn) {
        filters.push(`fade=t=in:st=0:d=1`);
      }
      if (job.fadeOut && job.duration) {
        filters.push(`fade=t=out:st=${job.duration - 1}:d=1`);
      }

      const outputOptions = [
        '-c:v', 'libx264',
        '-preset', this.hardwareAccel ? 'fast' : 'medium',
        '-b:v', q.bitrate,
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-c:a', 'aac',
        '-b:a', '192k',
      ];

      if (filters.length > 0) {
        outputOptions.push('-vf', filters.join(','));
      }

      if (job.imageUrl && job.audioUrl) {
        outputOptions.push('-shortest');
      }

      cmd.outputOptions(outputOptions)
        .output(outputPath)
        .on('progress', (progress) => {
          const percent = Math.min(100, Math.round(progress.percent || 0));
          this.emit('progress', { job, percent });
        })
        .on('end', () => {
          this.emit('complete', { job, outputPath });
          resolve({ outputPath });
        })
        .on('error', (err) => {
          this.emit('error', { job, error: err.message });
          reject(err);
        })
        .run();
    });
  }

  addToQueue(job) {
    job.id = Date.now().toString();
    job.status = 'pending';
    job.createdAt = new Date().toISOString();
    this.queue.push(job);
    this.processQueue();
    return job;
  }

  async processQueue() {
    if (this.activeJob) return;
    const next = this.queue.find(j => j.status === 'pending');
    if (!next) return;

    this.activeJob = next;
    next.status = 'rendering';
    next.startedAt = new Date().toISOString();

    try {
      const result = await this.renderVideo(next);
      next.status = 'complete';
      next.outputPath = result.outputPath;
      next.completedAt = new Date().toISOString();
    } catch (err) {
      next.status = 'failed';
      next.error = err.message;
    }

    this.activeJob = null;
    this.processQueue();
  }

  getQueue() {
    return this.queue;
  }

  clearCompleted() {
    this.queue = this.queue.filter(j => j.status !== 'complete' && j.status !== 'failed');
  }
}

module.exports = DesktopRenderer;
