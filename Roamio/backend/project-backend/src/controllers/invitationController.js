const invitationService = require('../services/invitationService');
const { parseId } = require('../services/tripAccessService');

// Errors with a statusCode are expected (validation/permission) and use the { error } shape
const sendError = (res, next, error) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ error: error.message, ...(error.code && { code: error.code }), ...error.extra });
  }
  return next(error);
};

exports.createInvite = async (req, res, next) => {
  try {
    const groupId = parseId(req.params.groupId, 'groupId');
    const result = await invitationService.createInvite(groupId, req.user.id, req.body || {});
    return res.status(201).json({ message: 'Invitation generated successfully.', ...result });
  } catch (error) {
    return sendError(res, next, error);
  }
};

exports.previewInvite = async (req, res, next) => {
  try {
    return res.status(200).json(await invitationService.previewInvite(req.params.token, req.user?.id ?? null, req.query.trip));
  } catch (error) {
    return sendError(res, next, error);
  }
};

exports.acceptInvite = async (req, res, next) => {
  try {
    const { token, tripId } = req.body || {};
    const result = await invitationService.acceptInvite(req.user.id, token, tripId);
    return res.status(200).json({
      message: `Successfully joined ${result.groupName}.`,
      groupId: result.groupId,
      tripId: result.tripId,
      role: result.role,
    });
  } catch (error) {
    return sendError(res, next, error);
  }
};
