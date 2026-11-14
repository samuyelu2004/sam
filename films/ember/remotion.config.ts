import { Config } from '@remotion/cli/config';

// 720x1280 at 30fps, and JPEG frames keep a 65 second render small.
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('swiftshader');
