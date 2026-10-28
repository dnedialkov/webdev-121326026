const bcrypt = require('bcrypt');
const { randomBytes } = require('crypto');
const userRepo = require('../db/userRepo');

async function authenticateUser(email, password) {
  if (!email || !password) {
    return { success: false, error: 'Invalid email or password' };
  }

  const user = await userRepo.findByEmail(email);
  if (!user) {
    return { success: false, error: 'Invalid email or password' };
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return { success: false, error: 'Invalid email or password' };
  }

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role
    }
  };
}

async function registerUser(email, password, role = 'member') {
  if (!email || !password) {
    return { success: false, error: 'Email and password are required' };
  }

  const existing = await userRepo.findByEmail(email);
  if (existing) {
    return { success: false, error: 'Email already registered' };
  }

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const newUser = await userRepo.createUser(email, passwordHash, role);
  return { success: true, user: newUser };
}

async function authenticateGoogleUser(email) {
  if (!email) {
    throw new Error('A verified Google email is required');
  }

  const existingUser = await userRepo.findByEmail(email);
  if (existingUser) {
    return {
      id: existingUser.id,
      email: existingUser.email,
      role: existingUser.role
    };
  }

  const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
  try {
    return await userRepo.createUser(email, passwordHash, 'member');
  } catch (error) {
    if (error.code !== '23505') {
      throw error;
    }

    const userCreatedConcurrently = await userRepo.findByEmail(email);
    if (!userCreatedConcurrently) {
      throw error;
    }
    return {
      id: userCreatedConcurrently.id,
      email: userCreatedConcurrently.email,
      role: userCreatedConcurrently.role
    };
  }
}

module.exports = {
  authenticateUser,
  registerUser,
  authenticateGoogleUser
};
