// seed.js - Populate database with demo data
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/productivi_flow';

// Schemas (same as server.js)
const userSchema = new mongoose.Schema({
  name: String, email: { type: String, unique: true, lowercase: true },
  password: String, points: { type: Number, default: 0 },
  streak: { type: Number, default: 0 }, lastActiveDate: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const sectionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title: String, icon: { type: String, default: '📁' }, order: { type: Number, default: 0 }
});

const subsectionSchema = new mongoose.Schema({
  sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title: String, order: { type: Number, default: 0 }
});

const taskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
  subsectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subsection' },
  title: String, type: { type: String, enum: ['daily', 'deadline'] },
  targetDate: Date, deadline: Date,
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  tags: [String], status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
  completedAt: Date
});

const achievementSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  achievementId: String, unlockedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Section = mongoose.model('Section', sectionSchema);
const Subsection = mongoose.model('Subsection', subsectionSchema);
const Task = mongoose.model('Task', taskSchema);
const Achievement = mongoose.model('Achievement', achievementSchema);

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Section.deleteMany({});
    await Subsection.deleteMany({});
    await Task.deleteMany({});
    await Achievement.deleteMany({});
    console.log('Cleared existing data');

    // Create demo users
    const hashedPassword = await bcrypt.hash('demo123', 10);
    const demoUser = await User.create({
      name: 'Alex Demo', email: 'demo@test.com',
      password: hashedPassword, points: 2450, streak: 12
    });
    
    await User.create({
      name: 'Test User', email: 'test@test.com',
      password: await bcrypt.hash('test123', 10), points: 500, streak: 3
    });
    console.log('Created demo users');

    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const in3Days = new Date(today); in3Days.setDate(today.getDate() + 3);
    const in5Days = new Date(today); in5Days.setDate(today.getDate() + 5);
    const inWeek = new Date(today); inWeek.setDate(today.getDate() + 7);

    // Section 1: DSA Practice
    const dsaSection = await Section.create({ userId: demoUser._id, title: 'DSA Practice', icon: '🧮', order: 0 });
    
    const arraysSub = await Subsection.create({ sectionId: dsaSection._id, userId: demoUser._id, title: 'Arrays & Strings', order: 0 });
    const treesSub = await Subsection.create({ sectionId: dsaSection._id, userId: demoUser._id, title: 'Trees & Graphs', order: 1 });
    const dpSub = await Subsection.create({ sectionId: dsaSection._id, userId: demoUser._id, title: 'Dynamic Programming', order: 2 });

    await Task.create([
      { userId: demoUser._id, sectionId: dsaSection._id, subsectionId: arraysSub._id, title: 'Two Sum Problem', type: 'daily', targetDate: today, priority: 'high', tags: ['leetcode', 'easy'], status: 'completed', completedAt: today },
      { userId: demoUser._id, sectionId: dsaSection._id, subsectionId: arraysSub._id, title: 'Maximum Subarray', type: 'deadline', deadline: in3Days, priority: 'medium', tags: ['dp'], status: 'pending' },
      { userId: demoUser._id, sectionId: dsaSection._id, subsectionId: arraysSub._id, title: 'Valid Anagram', type: 'daily', targetDate: today, priority: 'low', tags: ['strings'], status: 'pending' },
      { userId: demoUser._id, sectionId: dsaSection._id, subsectionId: treesSub._id, title: 'Binary Tree Traversal', type: 'daily', targetDate: today, priority: 'high', tags: ['trees'], status: 'pending' },
      { userId: demoUser._id, sectionId: dsaSection._id, subsectionId: treesSub._id, title: 'Graph BFS/DFS', type: 'deadline', deadline: in5Days, priority: 'high', tags: ['graphs'], status: 'pending' },
      { userId: demoUser._id, sectionId: dsaSection._id, subsectionId: dpSub._id, title: 'Climbing Stairs', type: 'daily', targetDate: tomorrow, priority: 'medium', tags: ['dp', 'easy'], status: 'pending' },
      { userId: demoUser._id, sectionId: dsaSection._id, subsectionId: dpSub._id, title: 'Coin Change Problem', type: 'deadline', deadline: inWeek, priority: 'high', tags: ['dp', 'medium'], status: 'pending' },
    ]);

    // Section 2: Job Prep
    const jobSection = await Section.create({ userId: demoUser._id, title: 'Job Prep', icon: '💼', order: 1 });
    
    const sysDesignSub = await Subsection.create({ sectionId: jobSection._id, userId: demoUser._id, title: 'System Design', order: 0 });
    const behavioralSub = await Subsection.create({ sectionId: jobSection._id, userId: demoUser._id, title: 'Behavioral', order: 1 });

    await Task.create([
      { userId: demoUser._id, sectionId: jobSection._id, subsectionId: sysDesignSub._id, title: 'URL Shortener Design', type: 'deadline', deadline: in5Days, priority: 'high', tags: ['design'], status: 'pending' },
      { userId: demoUser._id, sectionId: jobSection._id, subsectionId: sysDesignSub._id, title: 'Design Twitter', type: 'deadline', deadline: inWeek, priority: 'high', tags: ['design'], status: 'pending' },
      { userId: demoUser._id, sectionId: jobSection._id, subsectionId: behavioralSub._id, title: 'STAR Method Practice', type: 'daily', targetDate: today, priority: 'medium', tags: ['interview'], status: 'completed', completedAt: today },
      { userId: demoUser._id, sectionId: jobSection._id, subsectionId: behavioralSub._id, title: 'Mock Interview', type: 'deadline', deadline: in3Days, priority: 'high', tags: ['interview'], status: 'pending' },
    ]);

    // Section 3: Subjects
    const subjectsSection = await Section.create({ userId: demoUser._id, title: 'Subjects', icon: '📚', order: 2 });
    
    const osSub = await Subsection.create({ sectionId: subjectsSection._id, userId: demoUser._id, title: 'Operating Systems', order: 0 });
    const cnSub = await Subsection.create({ sectionId: subjectsSection._id, userId: demoUser._id, title: 'Computer Networks', order: 1 });
    const dbmsSub = await Subsection.create({ sectionId: subjectsSection._id, userId: demoUser._id, title: 'DBMS', order: 2 });

    await Task.create([
      { userId: demoUser._id, sectionId: subjectsSection._id, subsectionId: osSub._id, title: 'Process Scheduling', type: 'daily', targetDate: today, priority: 'medium', tags: ['os'], status: 'completed', completedAt: today },
      { userId: demoUser._id, sectionId: subjectsSection._id, subsectionId: osSub._id, title: 'Memory Management', type: 'daily', targetDate: tomorrow, priority: 'high', tags: ['os'], status: 'pending' },
      { userId: demoUser._id, sectionId: subjectsSection._id, subsectionId: cnSub._id, title: 'TCP/IP Model', type: 'daily', targetDate: today, priority: 'medium', tags: ['cn'], status: 'pending' },
      { userId: demoUser._id, sectionId: subjectsSection._id, subsectionId: cnSub._id, title: 'OSI Layers', type: 'deadline', deadline: in3Days, priority: 'medium', tags: ['cn'], status: 'pending' },
      { userId: demoUser._id, sectionId: subjectsSection._id, subsectionId: dbmsSub._id, title: 'Normalization', type: 'daily', targetDate: tomorrow, priority: 'medium', tags: ['dbms'], status: 'pending' },
    ]);

    // Section 4: Internship Tasks (no subsections)
    const internshipSection = await Section.create({ userId: demoUser._id, title: 'Internship Tasks', icon: '🏢', order: 3 });

    await Task.create([
      { userId: demoUser._id, sectionId: internshipSection._id, subsectionId: null, title: 'Complete API Documentation', type: 'deadline', deadline: in3Days, priority: 'high', tags: ['work'], status: 'pending' },
      { userId: demoUser._id, sectionId: internshipSection._id, subsectionId: null, title: 'Code Review', type: 'daily', targetDate: today, priority: 'medium', tags: ['work'], status: 'completed', completedAt: today },
      { userId: demoUser._id, sectionId: internshipSection._id, subsectionId: null, title: 'Stand-up Meeting Notes', type: 'daily', targetDate: today, priority: 'low', tags: ['meeting'], status: 'completed', completedAt: today },
      { userId: demoUser._id, sectionId: internshipSection._id, subsectionId: null, title: 'Bug Fixes Sprint', type: 'deadline', deadline: in5Days, priority: 'high', tags: ['dev'], status: 'pending' },
      { userId: demoUser._id, sectionId: internshipSection._id, subsectionId: null, title: 'Weekly Report', type: 'deadline', deadline: inWeek, priority: 'medium', tags: ['report'], status: 'pending' },
    ]);

    // Add some achievements
    await Achievement.create([
      { userId: demoUser._id, achievementId: 'first_task' },
      { userId: demoUser._id, achievementId: 'streak_7' },
      { userId: demoUser._id, achievementId: 'tasks_10' },
    ]);

    console.log('✅ Database seeded successfully!');
    console.log('\n📧 Demo Accounts:');
    console.log('   Email: demo@test.com | Password: demo123');
    console.log('   Email: test@test.com | Password: test123');
    
    process.exit(0);
  } catch (err) {
    console.error('Error seeding database:', err);
    process.exit(1);
  }
}

seed();