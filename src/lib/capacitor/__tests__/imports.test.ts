/**
 * Import tests for Capacitor wrappers
 * Verifies all modules can be imported without errors
 */

describe('Capacitor Wrapper Imports', () => {
  it('should import platform module', () => {
    const platform = require('../platform');
    expect(platform.getPlatform).toBeDefined();
    expect(platform.isNative).toBeDefined();
    expect(platform.isIOS).toBeDefined();
    expect(platform.isAndroid).toBeDefined();
    expect(platform.isWeb).toBeDefined();
    expect(platform.isPluginAvailable).toBeDefined();
    expect(platform.getPlatformInfo).toBeDefined();
  });

  it('should import geolocation module', () => {
    const geolocation = require('../geolocation');
    expect(geolocation.getCurrentPosition).toBeDefined();
    expect(geolocation.watchPosition).toBeDefined();
    expect(geolocation.clearWatch).toBeDefined();
    expect(geolocation.checkPermissions).toBeDefined();
    expect(geolocation.requestPermissions).toBeDefined();
    expect(geolocation.GeolocationException).toBeDefined();
  });

  it('should import camera module', () => {
    const camera = require('../camera');
    expect(camera.takePicture).toBeDefined();
    expect(camera.selectFromGallery).toBeDefined();
    expect(camera.checkPermissions).toBeDefined();
    expect(camera.requestPermissions).toBeDefined();
    expect(camera.CameraException).toBeDefined();
  });

  it('should import share module', () => {
    const share = require('../share');
    expect(share.share).toBeDefined();
    expect(share.shareText).toBeDefined();
    expect(share.shareUrl).toBeDefined();
    expect(share.canShare).toBeDefined();
    expect(share.canShareFiles).toBeDefined();
    expect(share.ShareException).toBeDefined();
  });

  it('should import notifications module', () => {
    const notifications = require('../notifications');
    expect(notifications.scheduleLocalNotification).toBeDefined();
    expect(notifications.cancelLocalNotification).toBeDefined();
    expect(notifications.cancelAllLocalNotifications).toBeDefined();
    expect(notifications.checkPermissions).toBeDefined();
    expect(notifications.requestPermissions).toBeDefined();
    expect(notifications.registerForPushNotifications).toBeDefined();
    expect(notifications.addPushNotificationListener).toBeDefined();
    expect(notifications.addPushNotificationActionListener).toBeDefined();
    expect(notifications.NotificationException).toBeDefined();
  });
});

describe('Capacitor Platform Detection (SSR-safe)', () => {
  it('should return web platform during SSR', () => {
    const { getPlatform } = require('../platform');
    const platform = getPlatform();
    expect(platform).toBe('web');
  });

  it('should return false for isNative during SSR', () => {
    const { isNative } = require('../platform');
    expect(isNative()).toBe(false);
  });

  it('should return web for isWeb during SSR', () => {
    const { isWeb } = require('../platform');
    expect(isWeb()).toBe(true);
  });
});
