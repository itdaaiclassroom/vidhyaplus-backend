import getPool from "../backend/server/config/db.js";

const QUESTIONS = [
  // === MATHEMATICS (subject_id: 4, grade: 10) ===
  // Real Numbers
  {
    subject_id: 4,
    chapter: "Real Numbers",
    grade: 10,
    topic_name: "Introduction",
    level: "Easy",
    question_text: "What is the HCF of two co-prime numbers?",
    option_a: "A) 0",
    option_b: "B) 1",
    option_c: "C) Their product",
    option_d: "D) None of these",
    correct_option: "B",
    explanation: "Two numbers are co-prime if their only common positive factor is 1. Therefore, their HCF is 1.",
    uploaded_by: "admin",
    assigned_for: "both"
  },
  {
    subject_id: 4,
    chapter: "Real Numbers",
    grade: 10,
    topic_name: "Introduction",
    level: "Medium",
    question_text: "If two positive integers a and b are written as a = x^3*y^2 and b = x*y^3, where x, y are prime numbers, then HCF(a, b) is:",
    option_a: "A) x*y",
    option_b: "B) x*y^2",
    option_c: "C) x^3*y^3",
    option_d: "D) x^2*y^2",
    correct_option: "B",
    explanation: "The HCF is the product of the lowest power of each common prime factor, which is x^1 and y^2, i.e., x*y^2.",
    uploaded_by: "admin",
    assigned_for: "both"
  },
  {
    subject_id: 4,
    chapter: "Real Numbers",
    grade: 10,
    topic_name: "Introduction",
    level: "Hard",
    question_text: "Which of the following numbers has a non-terminating repeating decimal expansion?",
    option_a: "A) 17/8",
    option_b: "B) 3/8",
    option_c: "C) 29/343",
    option_d: "D) 7/80",
    correct_option: "C",
    explanation: "A rational number has a terminating decimal expansion if the prime factorization of its denominator is of the form 2^n * 5^m. For 29/343, 343 = 7^3, which is not of this form.",
    uploaded_by: "admin",
    assigned_for: "both"
  },
  {
    subject_id: 4,
    chapter: "Real Numbers",
    grade: 10,
    topic_name: "Rational numbers",
    level: "Easy",
    question_text: "Which of the following is an irrational number?",
    option_a: "A) 22/7",
    option_b: "B) 3.1416",
    option_c: "C) Square root of 5",
    option_d: "D) 0",
    correct_option: "C",
    explanation: "The square root of any non-perfect square prime number (like 5) is always irrational.",
    uploaded_by: "admin",
    assigned_for: "both"
  },
  {
    subject_id: 4,
    chapter: "Real Numbers",
    grade: 10,
    topic_name: "Rational numbers",
    level: "Medium",
    question_text: "The product of a non-zero rational and an irrational number is always:",
    option_a: "A) Rational",
    option_b: "B) Irrational",
    option_c: "C) Integer",
    option_d: "D) Natural number",
    correct_option: "B",
    explanation: "The product of any non-zero rational number and an irrational number is always irrational.",
    uploaded_by: "admin",
    assigned_for: "both"
  },
  // Sets
  {
    subject_id: 4,
    chapter: "Sets",
    grade: 10,
    topic_name: "Types of Sets",
    level: "Easy",
    question_text: "If set A = {x : x is an even prime number}, then set A is:",
    option_a: "A) Empty set",
    option_b: "B) Singleton set",
    option_c: "C) Infinite set",
    option_d: "D) None of these",
    correct_option: "B",
    explanation: "The only even prime number is 2. So A = {2}, which contains exactly one element (singleton set).",
    uploaded_by: "admin",
    assigned_for: "both"
  },
  {
    subject_id: 4,
    chapter: "Sets",
    grade: 10,
    topic_name: "Types of Sets",
    level: "Medium",
    question_text: "If set A has n elements, then the number of subsets of A is:",
    option_a: "A) 2n",
    option_b: "B) n^2",
    option_c: "C) 2^n",
    option_d: "D) 2^(n-1)",
    correct_option: "C",
    explanation: "The total number of subsets of a set containing n elements is given by 2^n.",
    uploaded_by: "admin",
    assigned_for: "both"
  },
  {
    subject_id: 4,
    chapter: "Sets",
    grade: 10,
    topic_name: "Venn Diagrams",
    level: "Easy",
    question_text: "If A and B are disjoint sets, then A intersection B is:",
    option_a: "A) Universal Set (U)",
    option_b: "B) Null set (empty set)",
    option_c: "C) Set A",
    option_d: "D) Set B",
    correct_option: "B",
    explanation: "Disjoint sets have no elements in common, so their intersection is the empty set.",
    uploaded_by: "admin",
    assigned_for: "both"
  },
  {
    subject_id: 4,
    chapter: "Sets",
    grade: 10,
    topic_name: "Venn Diagrams",
    level: "Medium",
    question_text: "If n(A) = 15, n(B) = 20, and n(A union B) = 30, then n(A intersection B) is:",
    option_a: "A) 5",
    option_b: "B) 10",
    option_c: "C) 15",
    option_d: "D) 2",
    correct_option: "A",
    explanation: "Using the formula: n(A union B) = n(A) + n(B) - n(A intersection B) => 30 = 15 + 20 - x => x = 5.",
    uploaded_by: "admin",
    assigned_for: "both"
  },

  // === ENGLISH (subject_id: 3, grade: 10) ===
  // Personality Development
  {
    subject_id: 3,
    chapter: "Personality Development",
    grade: 10,
    topic_name: "Attitude is Altitude",
    level: "Easy",
    question_text: "Nick Vujicic was born with which of the following conditions?",
    option_a: "A) Phocomelia",
    option_b: "B) Polio",
    option_c: "C) Down Syndrome",
    option_d: "D) Cerebral Palsy",
    correct_option: "A",
    explanation: "Nick Vujicic was born with phocomelia, a rare disorder characterized by the absence of limbs.",
    uploaded_by: "admin",
    assigned_for: "both"
  },
  {
    subject_id: 3,
    chapter: "Personality Development",
    grade: 10,
    topic_name: "Attitude is Altitude",
    level: "Medium",
    question_text: "What did Nick say was the best thing that ever happened to him, which changed his life?",
    option_a: "A) Moving to the USA",
    option_b: "B) Learning to surf",
    option_c: "C) Meeting his wife Kanae Miyahara",
    option_d: "D) An article about a disabled man who achieved great things",
    correct_option: "D",
    explanation: "Nick read an newspaper article about a disabled man who achieved great things and realized he could inspire others.",
    uploaded_by: "admin",
    assigned_for: "both"
  },
  {
    subject_id: 3,
    chapter: "Personality Development",
    grade: 10,
    topic_name: "I Will Do It",
    level: "Easy",
    question_text: "Who is the protagonist of the lesson 'I Will Do It'?",
    option_a: "A) APJ Abdul Kalam",
    option_b: "B) Narayana Murthy",
    option_c: "C) Azim Premji",
    option_d: "D) Satya Nadella",
    correct_option: "B",
    explanation: "The lesson 'I Will Do It' describes the early life and determination of Infosys founder, N.R. Narayana Murthy.",
    uploaded_by: "admin",
    assigned_for: "both"
  },
  {
    subject_id: 3,
    chapter: "Personality Development",
    grade: 10,
    topic_name: "I Will Do It",
    level: "Medium",
    question_text: "Why could Narayana Murthy not join IIT even though he cleared the entrance exam?",
    option_a: "A) He did not get his preferred branch",
    option_b: "B) His father could not afford the expenses",
    option_c: "C) He fell sick on the admission day",
    option_d: "D) He wanted to study abroad",
    correct_option: "B",
    explanation: "His father, a school teacher, had a large family and could not afford the hostel and tuition fees of IIT.",
    uploaded_by: "admin",
    assigned_for: "both"
  },
  // Wit and Humour
  {
    subject_id: 3,
    chapter: "Wit and Humour",
    topic_name: "The Dear Departed Part I",
    grade: 10,
    level: "Easy",
    question_text: "In the play 'The Dear Departed', who is Abel Merryweather?",
    option_a: "A) Mrs. Slater's husband",
    option_b: "B) Mrs. Slater's father",
    option_c: "C) Mrs. Jordan's son",
    option_d: "D) A neighbor",
    correct_option: "B",
    explanation: "Abel Merryweather is the elderly father of Amelia Slater and Elizabeth Jordan.",
    uploaded_by: "admin",
    assigned_for: "both"
  },
  {
    subject_id: 3,
    chapter: "Wit and Humour",
    topic_name: "The Dear Departed Part I",
    grade: 10,
    level: "Medium",
    question_text: "What is Mrs. Slater trying to steal from her father's room before the Jordans arrive?",
    option_a: "A) His gold watch",
    option_b: "B) His bureau and clock",
    option_c: "C) His insurance documents",
    option_d: "D) His wallet",
    correct_option: "B",
    explanation: "Amelia Slater tries to pinch her father's handsome bureau and clock before her sister Elizabeth arrives.",
    uploaded_by: "admin",
    assigned_for: "both"
  },
  {
    subject_id: 3,
    chapter: "Wit and Humour",
    topic_name: "The Brave Potter",
    grade: 10,
    level: "Easy",
    question_text: "What was the potter looking for in the dark rainy night?",
    option_a: "A) A tiger",
    option_b: "B) His lost donkey",
    option_c: "C) Firewood",
    option_d: "D) His wife",
    correct_option: "B",
    explanation: "The potter was drunk and looking for his lost donkey in the heavy rain.",
    uploaded_by: "admin",
    assigned_for: "both"
  },
  {
    subject_id: 3,
    chapter: "Wit and Humour",
    topic_name: "The Brave Potter",
    grade: 10,
    level: "Medium",
    question_text: "Why did the tiger allow the potter to bind him with a rope and lead him home?",
    option_a: "A) The tiger was tamed",
    option_b: "B) The tiger thought the potter was the mysterious 'leak'",
    option_c: "C) The tiger was drugged",
    option_d: "D) The tiger was too weak to fight",
    correct_option: "B",
    explanation: "The tiger had overheard an old woman complaining about 'the leak' being worse than a tiger. When the potter grabbed him, the tiger assumed the potter was this terrible 'leak'.",
    uploaded_by: "admin",
    assigned_for: "both"
  }
];

async function seed() {
  const db = getPool();
  try {
    console.log("Seeding subject_quiz_bank questions...");

    // Remove any previous seed data we created to avoid duplicates
    await db.query("DELETE FROM subject_quiz_bank WHERE uploaded_by = 'admin'");
    console.log("Cleared old admin questions from subject_quiz_bank.");

    // Prepare rows
    const rows = QUESTIONS.map(q => [
      q.subject_id,
      q.chapter,
      q.grade,
      q.topic_name,
      q.level,
      q.question_text,
      q.option_a,
      q.option_b,
      q.option_c,
      q.option_d,
      q.correct_option,
      q.explanation,
      q.uploaded_by,
      q.assigned_for
    ]);

    await db.query(
      `INSERT INTO subject_quiz_bank
        (subject_id, chapter, grade, topic_name, level, question_text,
         option_a, option_b, option_c, option_d,
         correct_option, explanation, uploaded_by, assigned_for)
       VALUES ?`,
      [rows]
    );

    console.log(`Successfully seeded ${rows.length} questions into subject_quiz_bank!`);
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
}

seed();
