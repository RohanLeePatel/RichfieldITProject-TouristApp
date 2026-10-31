const prisma = require('../prismaClient');

class UserRepository {
  async findByEmail(email) {
    return await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null },
      include: { preferences: true },
    });
  }

  async findById(id) {
    return await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        isActive: true,
        isVerified: true,
        preferences: true,
        createdAt: true,
        termsAcceptedAt: true,
        termsVersion: true,
      },
    });
  }

  async acceptTerms(id, termsVersion) {
    return await prisma.user.update({
      where: { id },
      data: { termsAcceptedAt: new Date(), termsVersion },
      select: { termsVersion: true },
    });
  }

  async create(data) {
    return await prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        fullName: data.fullName,
        isVerified: false,
        otpHash: data.otpHash,
        otpExpiresAt: data.otpExpiresAt,
        termsAcceptedAt: data.termsAcceptedAt,
        termsVersion: data.termsVersion,
        preferences: {
          create: {}, // Auto-generates default ZAR currency / english / push alerts
        },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        createdAt: true,
      },
    });
  }

  // Stores a fresh OTP (and resets the failed-attempt counter); optionally refreshes credentials
  // when an unverified account is re-registered
  async setOtp(id, { otpHash, otpExpiresAt, passwordHash, fullName, termsAcceptedAt, termsVersion }) {
    return await prisma.user.update({
      where: { id },
      data: {
        otpHash,
        otpExpiresAt,
        otpAttempts: 0,
        ...(passwordHash && { passwordHash }),
        ...(fullName && { fullName }),
        ...(termsAcceptedAt && { termsAcceptedAt, termsVersion }),
      },
      select: { id: true },
    });
  }

  // Returns the new failed-attempt count; the OTP is invalidated once the limit is reached
  async recordFailedOtp(id, maxAttempts) {
    const user = await prisma.user.update({
      where: { id },
      data: { otpAttempts: { increment: 1 } },
      select: { otpAttempts: true },
    });
    if (user.otpAttempts >= maxAttempts) {
      await prisma.user.update({ where: { id }, data: { otpHash: null, otpExpiresAt: null } });
    }
    return user.otpAttempts;
  }

  // Single-use: only succeeds if the stored hash is still the one that was just matched
  async markVerified(id, otpHash) {
    const result = await prisma.user.updateMany({
      where: { id, otpHash, isVerified: false },
      data: { isVerified: true, otpHash: null, otpExpiresAt: null, otpAttempts: 0 },
    });
    return result.count === 1;
  }

  // Stores a fresh reset code hash and resets the failed-attempt counter
  async setResetPasswordOtp(userId, hash, expiresAt) {
    return await prisma.user.update({
      where: { id: userId },
      data: { resetPasswordOtpHash: hash, resetPasswordExpiresAt: expiresAt, resetPasswordAttempts: 0 },
      select: { id: true },
    });
  }

  // Returns the new failed-attempt count; the code is invalidated once the limit is reached
  async recordFailedResetAttempt(userId, maxAttempts = 5) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { resetPasswordAttempts: { increment: 1 } },
      select: { resetPasswordAttempts: true },
    });
    if (user.resetPasswordAttempts >= maxAttempts) {
      await prisma.user.update({
        where: { id: userId },
        data: { resetPasswordOtpHash: null, resetPasswordExpiresAt: null },
      });
    }
    return user.resetPasswordAttempts;
  }

  // Single-use: when expectedHash is given, only succeeds if that exact code is still the stored one
  async updatePasswordAndClearResetOtp(userId, hashedPassword, expectedHash) {
    const result = await prisma.user.updateMany({
      where: { id: userId, ...(expectedHash && { resetPasswordOtpHash: expectedHash }) },
      data: {
        passwordHash: hashedPassword,
        resetPasswordOtpHash: null,
        resetPasswordExpiresAt: null,
        resetPasswordAttempts: 0,
      },
    });
    return result.count === 1;
  }

  async update(id, updateData) {
    return await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        preferences: true,
      },
    });
  }
}

module.exports = new UserRepository();