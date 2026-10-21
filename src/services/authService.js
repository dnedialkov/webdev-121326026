const bcrypt = require('bcrypt');
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

module.exports = {
  authenticateUser,
  registerUser
};
