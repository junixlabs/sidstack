/**
 * Tunnel API Routes
 *
 * Endpoints for managing local tunnels (cloudflared/ngrok)
 */

import { Router, type Router as RouterType } from 'express';
import tunnelService, { TunnelProvider } from '../services/tunnel';

const router: RouterType = Router();

/**
 * GET /api/tunnel/status
 * Get current tunnel status
 */
router.get('/status', (_req, res) => {
  try {
    const info = tunnelService.getInfo();
    res.json({
      success: true,
      ...info,
      webhookUrl: tunnelService.getWebhookUrl(),
    });
  } catch (error) {
    console.error('[tunnel] Status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get tunnel status' });
  }
});

/**
 * GET /api/tunnel/providers
 * List available tunnel providers
 */
router.get('/providers', (_req, res) => {
  try {
    const providers = tunnelService.detectProviders();
    const bestProvider = tunnelService.getBestProvider();

    res.json({
      success: true,
      providers,
      recommended: bestProvider,
    });
  } catch (error) {
    console.error('[tunnel] Providers error:', error);
    res.status(500).json({ success: false, error: 'Failed to detect providers' });
  }
});

/**
 * POST /api/tunnel/start
 * Start a tunnel
 */
router.post('/start', async (req, res) => {
  try {
    const { provider } = req.body as { provider?: TunnelProvider };

    console.log(`[tunnel] Starting tunnel${provider ? ` with ${provider}` : ''}...`);
    const info = await tunnelService.start(provider);

    if (info.status === 'error') {
      res.status(400).json({
        success: false,
        ...info,
      });
    } else {
      res.json({
        success: true,
        ...info,
        webhookUrl: tunnelService.getWebhookUrl(),
      });
    }
  } catch (error) {
    console.error('[tunnel] Start error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start tunnel',
    });
  }
});

/**
 * POST /api/tunnel/stop
 * Stop the tunnel
 */
router.post('/stop', (_req, res) => {
  try {
    console.log('[tunnel] Stopping tunnel...');
    const info = tunnelService.stop();

    res.json({
      success: true,
      ...info,
      webhookUrl: tunnelService.getWebhookUrl(),
    });
  } catch (error) {
    console.error('[tunnel] Stop error:', error);
    res.status(500).json({ success: false, error: 'Failed to stop tunnel' });
  }
});

export { router as tunnelRouter };
