import jwt from 'jsonwebtoken';
import User from '../../models/User.js';

/**
 * JWT Auth Guard middleware.
 *
 * Reads the `Authorization: Bearer <token>` header, verifies the JWT,
 * loads the matching User from MongoDB and attaches it to `req.user`.
 *
 * Usage:
 *   router.get('/protected', authGuard, controller);
 */
async function authGuard(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authorization header missing or malformed. Expected: Bearer <token>',
      });
    }

    const token = authHeader.split(' ')[1];

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (err) {
      const message =
        err.name === 'TokenExpiredError'
          ? 'Access token expired. Please refresh.'
          : 'Invalid access token.';
      return res.status(401).json({ success: false, message });
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export default authGuard;
