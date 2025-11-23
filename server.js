// server.js - Main Express Server
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Environment variable validation
if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is not set!');
  console.error('Please set MONGODB_URI in your Render environment variables.');
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET not set, using default (not recommended for production)');
}

// MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB Connected');
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
  }
};

connectDB();

// Handle MongoDB connection errors after initial connection
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

// ==================== SCHEMAS ====================

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true,
    index: true 
  },
  password: { type: String, required: true },
  points: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  lastActiveDate: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

// Remove duplicate index warning
userSchema.index({ email: 1 }, { unique: true });

// Section Schema
const sectionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  icon: { type: String, default: '📁' },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Subsection Schema
const subsectionSchema = new mongoose.Schema({
  sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Task Schema
const taskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true, index: true },
  subsectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subsection', default: null, index: true },
  title: { type: String, required: true },
  type: { type: String, enum: ['daily', 'deadline'], required: true },
  targetDate: { type: Date, index: true },
  deadline: { type: Date, index: true },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  tags: [{ type: String }],
  status: { type: String, enum: ['pending', 'completed'], default: 'pending', index: true },
  completedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

// Achievement Schema
const achievementSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  achievementId: { type: String, required: true },
  unlockedAt: { type: Date, default: Date.now }
});

achievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });

// Models
const User = mongoose.model('User', userSchema);
const Section = mongoose.model('Section', sectionSchema);
const Subsection = mongoose.model('Subsection', subsectionSchema);
const Task = mongoose.model('Task', taskSchema);
const Achievement = mongoose.model('Achievement', achievementSchema);

// ==================== MIDDLEWARE ====================

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    
    req.user = user;
    req.userId = user._id;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ==================== HEALTH CHECK ====================

app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Task Manager API is running',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// ==================== AUTH ROUTES ====================

// Signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) return res.status(400).json({ error: 'Email already exists' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email: email.toLowerCase(), password: hashedPassword });
    await user.save();
    
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ 
      token, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        points: 0, 
        streak: 0 
      } 
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });
    
    // Update streak
    const today = new Date().setHours(0,0,0,0);
    const lastActive = new Date(user.lastActiveDate).setHours(0,0,0,0);
    const dayDiff = (today - lastActive) / (1000 * 60 * 60 * 24);
    
    if (dayDiff === 1) user.streak += 1;
    else if (dayDiff > 1) user.streak = 1;
    user.lastActiveDate = new Date();
    await user.save();
    
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        points: user.points, 
        streak: user.streak 
      } 
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const tasksCompleted = await Task.countDocuments({ userId: req.userId, status: 'completed' });
    const totalTasks = await Task.countDocuments({ userId: req.userId });
    res.json({ 
      user: { 
        id: req.user._id, 
        name: req.user.name, 
        email: req.user.email, 
        points: req.user.points, 
        streak: req.user.streak, 
        tasksCompleted, 
        totalTasks 
      } 
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== SECTION ROUTES ====================

// Get all sections with subsections and tasks
app.get('/api/sections', authMiddleware, async (req, res) => {
  try {
    const sections = await Section.find({ userId: req.userId }).sort('order');
    const result = await Promise.all(sections.map(async (section) => {
      const subsections = await Subsection.find({ sectionId: section._id }).sort('order');
      const sectionTasks = await Task.find({ sectionId: section._id, subsectionId: null });
      
      const subsWithTasks = await Promise.all(subsections.map(async (sub) => {
        const tasks = await Task.find({ subsectionId: sub._id });
        const completed = tasks.filter(t => t.status === 'completed').length;
        return { 
          ...sub.toObject(), 
          id: sub._id, 
          tasks, 
          completionPercent: tasks.length ? Math.round((completed / tasks.length) * 100) : 0 
        };
      }));
      
      const allTasks = [...sectionTasks, ...subsWithTasks.flatMap(s => s.tasks)];
      const completed = allTasks.filter(t => t.status === 'completed').length;
      
      return { 
        ...section.toObject(), 
        id: section._id, 
        subsections: subsWithTasks, 
        tasks: sectionTasks, 
        completionPercent: allTasks.length ? Math.round((completed / allTasks.length) * 100) : 0 
      };
    }));
    res.json(result);
  } catch (err) {
    console.error('Get sections error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create section
app.post('/api/sections', authMiddleware, async (req, res) => {
  try {
    const { title, icon } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const count = await Section.countDocuments({ userId: req.userId });
    const section = new Section({ userId: req.userId, title, icon: icon || '📁', order: count });
    await section.save();
    res.status(201).json({ 
      ...section.toObject(), 
      id: section._id, 
      subsections: [], 
      tasks: [], 
      completionPercent: 0 
    });
  } catch (err) {
    console.error('Create section error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update section
app.put('/api/sections/:id', authMiddleware, async (req, res) => {
  try {
    const section = await Section.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId }, 
      req.body, 
      { new: true }
    );
    if (!section) return res.status(404).json({ error: 'Section not found' });
    res.json(section);
  } catch (err) {
    console.error('Update section error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete section
app.delete('/api/sections/:id', authMiddleware, async (req, res) => {
  try {
    await Task.deleteMany({ sectionId: req.params.id });
    await Subsection.deleteMany({ sectionId: req.params.id });
    await Section.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ message: 'Section deleted' });
  } catch (err) {
    console.error('Delete section error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== SUBSECTION ROUTES ====================

// Create subsection
app.post('/api/sections/:sectionId/subsections', authMiddleware, async (req, res) => {
  try {
    const { title } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const count = await Subsection.countDocuments({ sectionId: req.params.sectionId });
    const subsection = new Subsection({ 
      sectionId: req.params.sectionId, 
      userId: req.userId, 
      title, 
      order: count 
    });
    await subsection.save();
    res.status(201).json({ 
      ...subsection.toObject(), 
      id: subsection._id, 
      tasks: [], 
      completionPercent: 0 
    });
  } catch (err) {
    console.error('Create subsection error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update subsection
app.put('/api/subsections/:id', authMiddleware, async (req, res) => {
  try {
    const subsection = await Subsection.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId }, 
      req.body, 
      { new: true }
    );
    if (!subsection) return res.status(404).json({ error: 'Subsection not found' });
    res.json(subsection);
  } catch (err) {
    console.error('Update subsection error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete subsection
app.delete('/api/subsections/:id', authMiddleware, async (req, res) => {
  try {
    await Task.deleteMany({ subsectionId: req.params.id });
    await Subsection.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ message: 'Subsection deleted' });
  } catch (err) {
    console.error('Delete subsection error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== TASK ROUTES ====================

// Create task
app.post('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const { sectionId, subsectionId, title, type, targetDate, deadline, priority, tags } = req.body;
    
    if (!sectionId || !title || !type) {
      return res.status(400).json({ error: 'Section ID, title, and type are required' });
    }
    
    const task = new Task({
      userId: req.userId, 
      sectionId, 
      subsectionId: subsectionId || null,
      title, 
      type, 
      targetDate: type === 'daily' ? (targetDate || new Date()) : null,
      deadline: type === 'deadline' ? deadline : null, 
      priority: priority || 'medium', 
      tags: tags || []
    });
    await task.save();
    res.status(201).json({ ...task.toObject(), id: task._id });
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update task
app.put('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId }, 
      req.body, 
      { new: true }
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Complete task
app.post('/api/tasks/:id/complete', authMiddleware, async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.status === 'completed') return res.status(400).json({ error: 'Task already completed' });
    
    task.status = 'completed';
    task.completedAt = new Date();
    await task.save();
    
    // Award points
    let points = 50;
    if (task.priority === 'high') points = 100;
    else if (task.priority === 'medium') points = 75;
    
    // Bonus for completing before deadline
    if (task.type === 'deadline' && task.deadline && new Date() < new Date(task.deadline)) {
      points += 25;
    }
    
    req.user.points += points;
    await req.user.save();
    
    // Check achievements
    const achievements = await checkAchievements(req.userId);
    
    res.json({ 
      task, 
      pointsEarned: points, 
      totalPoints: req.user.points, 
      newAchievements: achievements 
    });
  } catch (err) {
    console.error('Complete task error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete task
app.delete('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    await Task.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get tasks by date
app.get('/api/tasks/date/:date', authMiddleware, async (req, res) => {
  try {
    const date = new Date(req.params.date);
    const start = new Date(date.setHours(0,0,0,0));
    const end = new Date(date.setHours(23,59,59,999));
    
    const tasks = await Task.find({
      userId: req.userId,
      $or: [
        { targetDate: { $gte: start, $lte: end } },
        { deadline: { $gte: start, $lte: end } }
      ]
    }).populate('sectionId', 'title icon');
    
    const result = tasks.map(t => ({
      ...t.toObject(), 
      id: t._id,
      sectionName: t.sectionId?.title, 
      sectionIcon: t.sectionId?.icon
    }));
    res.json(result);
  } catch (err) {
    console.error('Get tasks by date error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get calendar stats
app.get('/api/tasks/calendar/:year/:month', authMiddleware, async (req, res) => {
  try {
    const { year, month } = req.params;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);
    
    const tasks = await Task.find({
      userId: req.userId,
      $or: [
        { targetDate: { $gte: start, $lte: end } },
        { deadline: { $gte: start, $lte: end } }
      ]
    });
    
    const stats = {};
    tasks.forEach(task => {
      const date = task.targetDate || task.deadline;
      const day = new Date(date).getDate();
      if (!stats[day]) stats[day] = { t: 0, c: 0 };
      stats[day].t++;
      if (task.status === 'completed') stats[day].c++;
    });
    res.json(stats);
  } catch (err) {
    console.error('Get calendar stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== ACHIEVEMENTS ====================

const ACHIEVEMENTS = [
  { 
    id: 'first_task', 
    title: 'First Steps', 
    desc: 'Complete your first task', 
    icon: '🎯', 
    points: 50, 
    check: async (userId) => await Task.countDocuments({ userId, status: 'completed' }) >= 1 
  },
  { 
    id: 'streak_7', 
    title: 'On Fire', 
    desc: '7 day streak', 
    icon: '🔥', 
    points: 200, 
    check: async (userId) => { 
      const u = await User.findById(userId); 
      return u.streak >= 7; 
    } 
  },
  { 
    id: 'tasks_100', 
    title: 'Centurion', 
    desc: 'Complete 100 tasks', 
    icon: '💯', 
    points: 500, 
    check: async (userId) => await Task.countDocuments({ userId, status: 'completed' }) >= 100 
  },
  { 
    id: 'early_10', 
    title: 'Early Bird', 
    desc: 'Complete 10 tasks before deadline', 
    icon: '🌅', 
    points: 150, 
    check: async (userId) => await Task.countDocuments({ 
      userId, 
      status: 'completed', 
      type: 'deadline', 
      $expr: { $lt: ['$completedAt', '$deadline'] } 
    }) >= 10 
  },
  { 
    id: 'points_1000', 
    title: 'Point Master', 
    desc: 'Earn 1000 points', 
    icon: '⭐', 
    points: 300, 
    check: async (userId) => { 
      const u = await User.findById(userId); 
      return u.points >= 1000; 
    } 
  },
  { 
    id: 'tasks_10', 
    title: 'Getting Started', 
    desc: 'Complete 10 tasks', 
    icon: '🚀', 
    points: 100, 
    check: async (userId) => await Task.countDocuments({ userId, status: 'completed' }) >= 10 
  },
];

async function checkAchievements(userId) {
  const newAchievements = [];
  for (const ach of ACHIEVEMENTS) {
    const existing = await Achievement.findOne({ userId, achievementId: ach.id });
    if (!existing && await ach.check(userId)) {
      await new Achievement({ userId, achievementId: ach.id }).save();
      const user = await User.findById(userId);
      user.points += ach.points;
      await user.save();
      newAchievements.push({ ...ach, unlockedAt: new Date() });
    }
  }
  return newAchievements;
}

// Get achievements
app.get('/api/achievements', authMiddleware, async (req, res) => {
  try {
    const unlocked = await Achievement.find({ userId: req.userId });
    const unlockedIds = unlocked.map(a => a.achievementId);
    const result = ACHIEVEMENTS.map(a => ({
      ...a, 
      check: undefined,
      unlocked: unlockedIds.includes(a.id),
      unlockedAt: unlocked.find(u => u.achievementId === a.id)?.unlockedAt
    }));
    res.json(result);
  } catch (err) {
    console.error('Get achievements error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== STATS ====================

app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const tasksCompleted = await Task.countDocuments({ userId: req.userId, status: 'completed' });
    const totalTasks = await Task.countDocuments({ userId: req.userId });
    res.json({ 
      points: req.user.points, 
      streak: req.user.streak, 
      tasksCompleted, 
      totalTasks 
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Weekly heatmap data
app.get('/api/stats/weekly', authMiddleware, async (req, res) => {
  try {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const tasks = await Task.find({
      userId: req.userId,
      $or: [
        { targetDate: { $gte: weekAgo, $lte: today } },
        { deadline: { $gte: weekAgo, $lte: today } }
      ]
    });
    
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dayTasks = tasks.filter(t => {
        const td = t.targetDate || t.deadline;
        return new Date(td).toDateString() === d.toDateString();
      });
      const completed = dayTasks.filter(t => t.status === 'completed').length;
      days.push({ 
        date: d, 
        total: dayTasks.length, 
        completed, 
        percent: dayTasks.length ? Math.round((completed / dayTasks.length) * 100) : 0 
      });
    }
    res.json(days);
  } catch (err) {
    console.error('Get weekly stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});