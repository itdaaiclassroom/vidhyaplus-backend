# -*- coding: utf-8 -*-
"""Generates curriculum_grade10_curriculum_load.sql from structured lesson data."""
import os
import textwrap

OUT = os.path.join(os.path.dirname(__file__), "..", "curriculum_grade10_curriculum_load.sql")

# (chapter_no, name, month, week, periods, summary)
TELUGU_CH = [
    (1, "దానశీలము (Padyam)", "June", "Week 1-2", 6, "Poem meaning, values, explanation"),
    (2, "మాతృభాష ప్రాముఖ్యత", "June", "Week 3-4", 7, "Importance of language, prose"),
    (3, "కొత్తబాట", "July", "Week 1-2", 8, "Story analysis"),
    (4, "నగరగీతం", "July", "Week 3-4", 6, "Poem interpretation"),
    (5, "భాగ్యోదయం", "August", "Week 1-2", 7, "Biography"),
    (6, "శతక మాధుర్యం", "August", "Week 3-4", 6, "Moral values"),
    (7, "జీవనభాష్యం", "September", "Week 1-2", 7, "Essay understanding"),
    (8, "గోల్కొండ పట్టణం", "September", "Week 3-4", 6, "Historical essay"),
    (9, "భిక్షువు", "October", "Week 1-2", 6, "Poem"),
    (10, "భూమిక", "October", "Week 3-4", 6, "Literary essay"),
    (11, "తెలంగాణ", "November", "Week 1-2", 6, "Telangana culture"),
    (12, "రామాయణం భాగాలు (Supplementary)", "November", "Week 3-4", 8, "Reading and understanding"),
]

HINDI_MAIN = [
    (1, "बरसते बादल (कविता)", "June", "Week 1-2", 6, "Poem explanation, meaning"),
    (2, "ईदगाह (कहानी)", "June", "Week 3-4", 8, "Story, values"),
    (3, "माँ मुझे आने दे!", "July", "Week 2", 6, "Poem"),
    (4, "कण-कण का अधिकारी", "August", "Week 1-2", 6, "Poem"),
    (5, "लोकगीत", "August", "Week 3-4", 6, "Essay"),
    (6, "अंतर्राष्ट्रीय स्तर पर हिंदी", "September", "Week 2", 5, "Letter"),
    (7, "भक्ति पद", "October", "Week 1-2", 6, "Poem"),
    (8, "स्वराज्य की नींव", "October", "Week 3-4", 7, "Drama"),
    (9, "दक्षिण गंगा गोदावरी", "November", "Week 2-3", 6, "Travelogue"),
    (10, "नीति दोहे", "December", "Week 1-2", 5, "Poem"),
    (11, "जल ही जीवन है", "December", "Week 3", 6, "Story"),
    (12, "धरती के सवाल अंतरिक्ष के जवाब", "January", "Week 1-2", 6, "Interview"),
]

HINDI_SUPP = [
    (101, "यह रास्ता कहाँ जाता है?", "July", "Week 1", 4, "Drama reading"),
    (102, "शांति की राह में", "July", "Week 3-4", 4, "Essay"),
    (103, "उलझन", "September", "Week 1", 3, "Poem"),
    (104, "हम सब एक हैं", "September", "Week 3-4", 4, "Essay"),
    (105, "हम भारतीय", "November", "Week 1", 3, "Poem"),
    (106, "अपने स्कूल को उपहार", "November", "Week 4", 4, "Story"),
    (107, "क्या आपको पता है?", "December", "Week 4", 4, "Informative"),
    (108, "अनोखा उपाय", "January", "Week 3", 4, "Story"),
]

ENGLISH_CH = [
    (1, "Personality Development", "June", "Full", 12, "Reading + Writing + Grammar"),
    (2, "Wit and Humour", "July", "Full", 12, "Drama + Story"),
    (3, "Human Relations", "August", "Full", 10, "Poem + Prose"),
    (4, "Films and Theatre", "September", "Full", 10, "Biography + Film"),
    (5, "Social Issues", "October", "Full", 10, "Social awareness"),
    (6, "Bio-Diversity", "November", "Full", 10, "Environment"),
    (7, "Nation and Diversity", "December", "Full", 10, "Unity"),
    (8, "Human Rights", "January", "Full", 10, "Rights awareness"),
]

MATH_CH = [
    (1, "Real Numbers", "June", "Week 1-2", 15, "HCF, LCM, Euclid algorithm"),
    (2, "Sets", "June", "Week 3-4", 8, "Set operations"),
    (3, "Polynomials", "July", "Week 1-2", 8, "Zeros, graphs"),
    (4, "Pair of Linear Equations", "September", "Week 1-2", 15, "Solving equations"),
    (5, "Quadratic Equations", "October", "Full", 12, "Roots"),
    (6, "Progressions", "January", "Week 1-2", 11, "AP"),
    (7, "Coordinate Geometry", "November", "Week 1-2", 12, "Distance formula"),
    (8, "Similar Triangles", "July-August", "Full", 18, "Theorems"),
    (9, "Tangents and Secants", "November", "Week 3-4", 15, "Circle properties"),
    (10, "Mensuration", "December", "Full", 10, "Surface areas"),
    (11, "Trigonometry", "August", "Full", 15, "Identities"),
    (12, "Applications of Trigonometry", "September", "Week 3-4", 8, "Heights and distances"),
    (13, "Probability", "January", "Week 3-4", 10, "Basic probability"),
    (14, "Statistics", "July", "Week 3-4", 15, "Mean, graphs"),
    (15, "Mathematical Modelling", "January", "Week 4", 8, "Real-life problems"),
]

PHYSICS_CH = [
    (1, "Reflection of Light at Curved Surfaces", "June", "Week 1-2", 6, "Mirrors, image formation, ray diagrams"),
    (2, "Chemical Equations", "June", "Week 3-4", 5, "Types, balancing, reactions"),
    (3, "Acids, Bases and Salts", "July", "Week 1-2", 8, "Properties, pH scale"),
    (4, "Refraction of Light at Curved Surfaces", "July", "Week 3-4", 9, "Lenses, image formation"),
    (5, "Human Eye and Colourful World", "August", "Week 1-2", 8, "Eye defects, dispersion"),
    (6, "Structure of Atom", "August", "Week 3-4", 7, "Atomic models"),
    (7, "Periodic Table", "September", "Week 1-2", 8, "Classification, trends"),
    (8, "Chemical Bonding", "September", "Week 3-4", 10, "Ionic and covalent bonds"),
    (9, "Electric Current", "October", "Week 1-2", 9, "Ohm law, circuits"),
    (10, "Electromagnetism", "October", "Week 3-4", 10, "Magnetic effects"),
    (11, "Principles of Metallurgy", "November", "Week 1-2", 6, "Extraction of metals"),
    (12, "Carbon and its Compounds", "November", "Week 3-4", 10, "Hydrocarbons"),
]

BIO_CH = [
    (1, "Nutrition", "June", "Full", 10, "Photosynthesis, digestion"),
    (2, "Respiration", "July", "Week 1-2", 10, "Breathing, cellular respiration"),
    (3, "Circulation", "July", "Week 3-4", 10, "Blood flow, heart"),
    (4, "Excretion", "August", "Week 1-2", 10, "Kidney function"),
    (5, "Coordination", "September", "Full", 10, "Nervous system"),
    (6, "Reproduction", "October", "Full", 15, "Human and plant reproduction"),
    (7, "Coordination in Life Processes", "November", "Full", 10, "Integration"),
    (8, "Heredity and Evolution", "December", "Week 2-3", 15, "Genetics"),
    (9, "Our Environment", "December", "Week 4", 10, "Ecosystem"),
    (10, "Natural Resources", "January", "Full", 10, "Conservation"),
]

SOCIAL_CH = [
    (1, "India: Relief Features", "June", "Week 1-2", 8, "Location, relief divisions"),
    (2, "Ideas of Development", "June", "Week 3-4", 7, "Development concepts"),
    (3, "Production and Employment", "July", "Week 1-2", 8, "Sectors, employment"),
    (4, "Climate of India", "July", "Week 3-4", 8, "Climate and monsoon"),
    (5, "Rivers and Water Resources", "August", "Week 1-2", 7, "River systems"),
    (6, "Population", "August", "Week 3-4", 6, "Demographics"),
    (7, "Settlements and Migration", "September", "Week 1-2", 7, "Migration"),
    (8, "Rampur Village Economy", "September", "Week 3-4", 6, "Rural economy"),
    (9, "Globalisation", "October", "Week 1-2", 6, "MNCs"),
    (10, "Food Security", "October", "Week 3-4", 6, "PDS"),
    (11, "Sustainable Development", "November", "Week 1-2", 7, "Sustainability"),
    (12, "World Wars", "November", "Week 3-4", 8, "WW1 and WW2"),
    (13, "National Liberation", "December", "Week 1", 5, "Colonial struggles"),
    (14, "National Movement in India", "December", "Week 2-3", 6, "Freedom struggle"),
    (15, "Indian Constitution", "December", "Week 4", 5, "Rights"),
    (16, "Election Process", "January", "Week 1-2", 5, "Elections"),
    (17, "Independent India", "January", "Week 3", 5, "Nation building"),
    (18, "Political Trends", "January", "Week 4", 5, "Reforms"),
    (19, "Post-War World", "February", "Week 1", 5, "Cold War"),
    (20, "Social Movements", "February", "Week 2", 5, "Movements"),
    (21, "Telangana Movement", "February", "Week 3", 6, "State formation"),
]


def esc(s):
    return s.replace("\\", "\\\\").replace("'", "''")


def sql_chapter_row(cid, sid, ch_no, name, month, week, periods, summary):
    return f"({cid},{sid},10,{ch_no},'{esc(name)}','{esc(month)}','{esc(week)}',{periods},'{esc(summary)}')"


def build_chapters():
    rows = []
    cid = 1
    for ch in TELUGU_CH:
        rows.append(sql_chapter_row(cid, 1, ch[0], ch[1], ch[2], ch[3], ch[4], ch[5]))
        cid += 1
    for ch in HINDI_MAIN:
        rows.append(sql_chapter_row(cid, 2, ch[0], ch[1], ch[2], ch[3], ch[4], ch[5]))
        cid += 1
    for ch in HINDI_SUPP:
        rows.append(sql_chapter_row(cid, 2, ch[0], ch[1], ch[2], ch[3], ch[4], ch[5]))
        cid += 1
    for ch in ENGLISH_CH:
        rows.append(sql_chapter_row(cid, 3, ch[0], ch[1], ch[2], ch[3], ch[4], ch[5]))
        cid += 1
    for ch in MATH_CH:
        rows.append(sql_chapter_row(cid, 4, ch[0], ch[1], ch[2], ch[3], ch[4], ch[5]))
        cid += 1
    for ch in PHYSICS_CH:
        rows.append(sql_chapter_row(cid, 5, ch[0], ch[1], ch[2], ch[3], ch[4], ch[5]))
        cid += 1
    for ch in BIO_CH:
        rows.append(sql_chapter_row(cid, 6, ch[0], ch[1], ch[2], ch[3], ch[4], ch[5]))
        cid += 1
    for ch in SOCIAL_CH:
        rows.append(sql_chapter_row(cid, 7, ch[0], ch[1], ch[2], ch[3], ch[4], ch[5]))
        cid += 1
    return rows, cid - 1


# Per chapter: list of (concept, plan) for each period
def telugu_micro():
    return [
        [
            ("కవి పరిచయం మరియు పఠనం", "Poet introduction and poem reading"),
            ("పదార్థం", "Word meanings and vocabulary"),
            ("భావం", "Theme and interpretation"),
            ("విశ్లేషణ", "Analysis and discussion"),
            ("నీతి విలువలు", "Moral values"),
            ("ప్రశ్నలు మరియు పునర్విమర్శ", "Questions and revision"),
        ],
        [
            ("పరిచయం", "Introduction to mother tongue importance"),
            ("పాఠ్యం చదవడం", "Reading the lesson text"),
            ("భావం", "Theme and interpretation"),
            ("విశ్లేషణ", "Literary analysis"),
            ("ఉదాహరణలు", "Examples from society"),
            ("చర్చ", "Class discussion"),
            ("ప్రశ్నలు", "Questions and exercises"),
        ],
        [
            ("కథ ప్రారంభం", "Story introduction"),
            ("పాత్రలు", "Characters"),
            ("సంఘటనలు", "Events"),
            ("కొనసాగింపు", "Continuity and plot"),
            ("క్లైమాక్స్", "Climax"),
            ("సందేశం", "Message"),
            ("విశ్లేషణ", "Analysis"),
            ("ప్రశ్నలు", "Questions"),
        ],
        [
            ("పరిచయం", "Introduction"),
            ("పఠనం", "Reading"),
            ("పదార్థం", "Word meanings"),
            ("భావం", "Theme"),
            ("విశ్లేషణ", "Analysis"),
            ("ప్రశ్నలు", "Questions"),
        ],
        [
            ("పరిచయం", "Author introduction"),
            ("జీవితం", "Life sketch"),
            ("సంఘటనలు", "Key events"),
            ("విశ్లేషణ", "Analysis"),
            ("విలువలు", "Values"),
            ("చర్చ", "Discussion"),
            ("ప్రశ్నలు", "Questions"),
        ],
        [
            ("పరిచయం", "Introduction to śataka"),
            ("పఠనం", "Reading"),
            ("భావం", "Meaning"),
            ("నీతి", "Ethics"),
            ("విశ్లేషణ", "Analysis"),
            ("ప్రశ్నలు", "Questions"),
        ],
        [
            ("పరిచయం", "Introduction"),
            ("పాఠనం", "Reading"),
            ("భావం", "Theme"),
            ("విశ్లేషణ", "Analysis"),
            ("విలువలు", "Values"),
            ("చర్చ", "Discussion"),
            ("ప్రశ్నలు", "Questions"),
        ],
        [
            ("పరిచయం", "Introduction"),
            ("చరిత్ర", "History"),
            ("నిర్మాణం", "Architecture"),
            ("విశ్లేషణ", "Analysis"),
            ("ప్రాముఖ్యత", "Significance"),
            ("ప్రశ్నలు", "Questions"),
        ],
        [
            ("పరిచయం", "Introduction"),
            ("పఠనం", "Reading"),
            ("భావం", "Theme"),
            ("విశ్లేషణ", "Analysis"),
            ("సందేశం", "Message"),
            ("ప్రశ్నలు", "Questions"),
        ],
        [
            ("పరిచయం", "Introduction"),
            ("పాఠనం", "Reading"),
            ("భావం", "Theme"),
            ("విశ్లేషణ", "Analysis"),
            ("చర్చ", "Discussion"),
            ("ప్రశ్నలు", "Questions"),
        ],
        [
            ("పరిచయం", "Introduction"),
            ("సంస్కృతి", "Culture"),
            ("చరిత్ర", "History"),
            ("విశ్లేషణ", "Analysis"),
            ("చర్చ", "Discussion"),
            ("ప్రశ్నలు", "Questions"),
        ],
        [
            ("బాలకాండ", "Bālakāṇḍa overview"),
            ("బాలకాండ", "Bālakāṇḍa continued"),
            ("అరణ్యకాండ", "Araṇyakāṇḍa overview"),
            ("అరణ్యకాండ", "Araṇyakāṇḍa continued"),
            ("సుందరకాండ", "Sundarakāṇḍa overview"),
            ("సుందరకాండ", "Sundarakāṇḍa continued"),
            ("యుద్ధకాండ", "Yuddhakāṇḍa overview"),
            ("యుద్ధకాండ", "Yuddhakāṇḍa continued"),
        ],
    ]


def hindi_micro():
    hm = [
        [("कवि परिचय और पठन", "Poet intro and poem reading"), ("शब्दार्थ", "Vocabulary"), ("भावार्थ", "Meaning"),
         ("प्रकृति चित्रण", "Nature description"), ("अलंकार", "Figures of speech"), ("प्रश्न", "Questions and revision")],
        [("कहानी परिचय", "Story introduction"), ("कहानी परिचय", "Story introduction continued"),
         ("पात्र विश्लेषण", "Character analysis"), ("पात्र विश्लेषण", "Character analysis continued"),
         ("घटनाएँ", "Events"), ("घटनाएँ", "Events continued"), ("संदेश", "Message"), ("प्रश्न", "Questions")],
        [("पठन", "Reading"), ("शब्दार्थ", "Vocabulary"), ("भाव", "Theme"), ("विश्लेषण", "Analysis"),
         ("संदेश", "Message"), ("प्रश्न", "Questions")],
        [("पठन", "Reading"), ("अर्थ", "Meaning"), ("भाव", "Theme"), ("विश्लेषण", "Analysis"),
         ("मूल्य", "Values"), ("प्रश्न", "Questions")],
        [("परिचय", "Introduction"), ("पठन", "Reading"), ("अर्थ", "Meaning"), ("विश्लेषण", "Analysis"),
         ("महत्व", "Importance"), ("प्रश्न", "Questions")],
        [("परिचय", "Introduction"), ("पत्र संरचना", "Letter format"), ("विषय", "Content"), ("लेखन", "Writing"),
         ("प्रश्न", "Questions")],
        [("पठन", "Reading"), ("अर्थ", "Meaning"), ("भाव", "Theme"), ("विश्लेषण", "Analysis"),
         ("मूल्य", "Values"), ("प्रश्न", "Questions")],
        [("पठन", "Reading"), ("पठन", "Reading continued"), ("घटनाएँ", "Events"), ("घटनाएँ", "Events continued"),
         ("पात्र", "Characters"), ("संदेश", "Message"), ("प्रश्न", "Questions")],
        [("परिचय", "Introduction"), ("यात्रा वर्णन", "Travel description"), ("यात्रा वर्णन", "Travel description continued"),
         ("विश्लेषण", "Analysis"), ("महत्व", "Importance"), ("प्रश्न", "Questions")],
        [("पठन", "Reading"), ("अर्थ", "Meaning"), ("भाव", "Theme"), ("मूल्य", "Values"), ("प्रश्न", "Questions")],
        [("पठन", "Reading"), ("घटनाएँ", "Events"), ("घटनाएँ", "Events continued"), ("संदेश", "Message"),
         ("विश्लेषण", "Analysis"), ("प्रश्न", "Questions")],
        [("परिचय", "Introduction"), ("साक्षात्कार", "Interview reading"), ("साक्षात्कार", "Interview continued"),
         ("विश्लेषण", "Analysis"), ("लेखन", "Writing"), ("प्रश्न", "Questions")],
    ]
    hs = [
        [("पठन", "Reading"), ("पठन", "Reading continued"), ("संवाद", "Dialogue"), ("प्रश्न", "Questions")],
        [("परिचय", "Introduction"), ("पठन", "Reading"), ("विचार", "Ideas"), ("प्रश्न", "Questions")],
        [("पठन", "Reading"), ("भाव", "Theme"), ("प्रश्न", "Questions")],
        [("पठन", "Reading"), ("विचार", "Ideas"), ("संदेश", "Message"), ("प्रश्न", "Questions")],
        [("पठन", "Reading"), ("भाव", "Theme"), ("प्रश्न", "Questions")],
        [("पठन", "Reading"), ("घटनाएँ", "Events"), ("संदेश", "Message"), ("प्रश्न", "Questions")],
        [("पठन", "Reading"), ("जानकारी", "Information"), ("चर्चा", "Discussion"), ("प्रश्न", "Questions")],
        [("पठन", "Reading"), ("घटनाएँ", "Events"), ("संदेश", "Message"), ("प्रश्न", "Questions")],
    ]
    return hm + hs


def english_micro():
    return [
        [("Introduction and theme", "Introduction and theme discussion"), ("Attitude is Altitude", "Reading and meaning"),
         ("Attitude is Altitude", "Reading and meaning continued"), ("Vocabulary", "Vocabulary"),
         ("Grammar: Relative Clauses", "Grammar practice"), ("Every Success Story", "Reading"),
         ("Every Success Story", "Reading continued"), ("I Will Do It", "Reading"), ("I Will Do It", "Reading continued"),
         ("Writing: Biography", "Biography writing"), ("Activities and speaking", "Activities and speaking"),
         ("Revision", "Revision")],
        [("Introduction", "Introduction"), ("The Dear Departed Part I", "Drama"), ("The Dear Departed Part I", "Drama"), ("The Dear Departed Part I", "Drama"),
         ("The Dear Departed Part II", "Drama"), ("The Dear Departed Part II", "Drama"), ("The Brave Potter", "Story"),
         ("The Brave Potter", "Story continued"), ("Vocabulary", "Vocabulary"), ("Grammar", "Grammar"),
         ("Writing: Dialogue", "Dialogue writing"), ("Revision", "Revision")],
        [("Introduction", "Introduction"), ("The Journey", "Prose"), ("The Journey", "Prose continued"), ("The Journey", "Prose continued"),
         ("Another Woman (Poem)", "Poem"), ("The Never-Never Nest", "Drama"), ("The Never-Never Nest", "Drama"),
         ("Vocabulary", "Vocabulary"), ("Writing", "Writing task"), ("Revision", "Revision")],
        [("Introduction", "Introduction"), ("Rendezvous with Ray", "Biography"), ("Rendezvous with Ray", "Biography"), ("Rendezvous with Ray", "Biography"),
         ("Maya Bazaar", "Film study"), ("Maya Bazaar", "Film study continued"), ("Tribute", "Reading"),
         ("Vocabulary", "Vocabulary"), ("Writing", "Writing"), ("Revision", "Revision")],
        [("Introduction", "Introduction"), ("The Storeyed House Part I", "Story"), ("The Storeyed House Part I", "Story"), ("The Storeyed House Part I", "Story"),
         ("The Storeyed House Part II", "Story"), ("The Storeyed House Part II", "Story"), ("Abandoned (Poem)", "Poem"),
         ("Vocabulary", "Vocabulary"), ("Writing", "Writing"), ("Revision", "Revision")],
        [("Introduction", "Introduction"), ("Environment", "Text study"), ("Environment", "Text study"), ("Environment", "Text study"),
         ("Or Will the Dreamer Wake?", "Poem"), ("A Tale of Three Villages", "Story"), ("A Tale of Three Villages", "Story"), ("Vocabulary", "Vocabulary"),
         ("Writing", "Writing"), ("Revision", "Revision")],
        [("Introduction", "Introduction"), ("My Childhood", "Reading"), ("My Childhood", "Reading"), ("My Childhood", "Reading"),
         ("A Plea for India", "Poem"), ("Unity in Diversity", "Prose"), ("Unity in Diversity", "Prose"), ("Vocabulary", "Vocabulary"),
         ("Writing", "Writing"), ("Revision", "Revision")],
        [("Introduction", "Introduction"), ("Jamaican Fragment", "Reading"), ("Jamaican Fragment", "Reading"), ("Jamaican Fragment", "Reading"),
         ("Once Upon a Time", "Poem"), ("What is My Name?", "Story"), ("What is My Name?", "Story"), ("Vocabulary", "Vocabulary"),
         ("Writing", "Writing"), ("Revision", "Revision")],
    ]


def math_micro():
    return [
        # Real Numbers — 15
        [("Introduction and Euclid algorithm", "Introduction and Euclid algorithm"), ("Introduction and Euclid algorithm", "Continued"),
         ("HCF problems", "HCF problems"), ("HCF problems", "HCF problems continued"),
         ("Fundamental theorem of arithmetic", "Fundamental theorem"), ("Fundamental theorem of arithmetic", "Continued"),
         ("Prime factorisation", "Prime factorisation"), ("Prime factorisation", "Continued"),
         ("Decimal expansions", "Decimal expansions"), ("Decimal expansions", "Continued"),
         ("Rational vs irrational numbers", "Rational vs irrational"), ("Rational vs irrational numbers", "Continued"),
         ("Proof problems", "Proof problems"), ("Proof problems", "Continued"), ("Revision", "Revision")],
        # Sets — 8
        [("Introduction", "Introduction"), ("Types of sets", "Types of sets"), ("Union and intersection", "Union and intersection"),
         ("Union and intersection", "Continued"), ("Complement", "Complement"), ("Venn diagrams", "Venn diagrams"),
         ("Problems", "Problems"), ("Revision", "Revision")],
        # Polynomials — 8
        [("Introduction", "Introduction"), ("Zeros of polynomials", "Zeros"), ("Zeros of polynomials", "Continued"),
         ("Graphs", "Graphs"), ("Graphs", "Continued"), ("Relations", "Relations"), ("Problems", "Problems"), ("Revision", "Revision")],
        # Pair of linear equations — 15
        [("Introduction", "Introduction"), ("Introduction", "Continued"),
         ("Graphical method", "Graphical method"), ("Graphical method", "Continued"), ("Graphical method", "Continued"),
         ("Substitution method", "Substitution"), ("Substitution method", "Continued"), ("Substitution method", "Continued"),
         ("Elimination method", "Elimination"), ("Elimination method", "Continued"), ("Elimination method", "Continued"),
         ("Word problems", "Word problems"), ("Word problems", "Continued"),
         ("Revision", "Revision"), ("Revision", "Wrap-up")],
        # Quadratic — 12
        [("Introduction", "Introduction"), ("Introduction", "Continued"),
         ("Factorisation", "Factorisation"), ("Factorisation", "Continued"), ("Factorisation", "Continued"),
         ("Quadratic formula", "Formula"), ("Quadratic formula", "Continued"), ("Quadratic formula", "Continued"),
         ("Discriminant", "Discriminant"), ("Problems", "Problems"), ("Revision", "Revision")],
        # Progressions — 11
        [("Introduction", "Introduction"), ("Introduction", "Continued"),
         ("nth term", "nth term"), ("nth term", "Continued"), ("nth term", "Continued"),
         ("Sum formula", "Sum formula"), ("Sum formula", "Continued"), ("Sum formula", "Continued"),
         ("Problems", "Problems"), ("Problems", "Continued"), ("Revision", "Revision")],
        # Coordinate geometry — 12
        [("Basics", "Basics"), ("Basics", "Continued"),
         ("Distance formula", "Distance formula"), ("Distance formula", "Continued"), ("Distance formula", "Continued"), ("Distance formula", "Continued"),
         ("Section formula", "Section formula"), ("Section formula", "Continued"), ("Section formula", "Continued"),
         ("Problems", "Problems"), ("Problems", "Continued"), ("Revision", "Revision")],
        # Similar triangles — 18
        [("Introduction", "Introduction"), ("Introduction", "Continued"), ("Introduction", "Continued"),
         ("Criteria of similarity", "Criteria"), ("Criteria of similarity", "Continued"), ("Criteria of similarity", "Continued"), ("Criteria of similarity", "Continued"),
         ("Theorems", "Theorems"), ("Theorems", "Continued"), ("Theorems", "Continued"), ("Theorems", "Continued"),
         ("Applications", "Applications"), ("Applications", "Continued"), ("Applications", "Continued"), ("Applications", "Continued"),
         ("Problems", "Problems"), ("Problems", "Continued"), ("Revision", "Revision")],
        # Tangents and secants — 15
        [("Introduction", "Introduction"), ("Introduction", "Continued"), ("Introduction", "Continued"),
         ("Tangents", "Tangents"), ("Tangents", "Continued"), ("Tangents", "Continued"), ("Tangents", "Continued"),
         ("Secants", "Secants"), ("Secants", "Continued"), ("Secants", "Continued"), ("Secants", "Continued"),
         ("Problems", "Problems"), ("Problems", "Continued"), ("Problems", "Continued"), ("Revision", "Revision")],
        # Mensuration — 10
        [("Introduction", "Introduction"), ("Introduction", "Continued"),
         ("Surface area", "Surface area"), ("Surface area", "Continued"), ("Surface area", "Continued"),
         ("Volume", "Volume"), ("Volume", "Continued"), ("Volume", "Continued"),
         ("Problems", "Problems"), ("Revision", "Revision")],
        # Trigonometry — 15
        [("Introduction", "Introduction"), ("Introduction", "Continued"), ("Introduction", "Continued"),
         ("Trigonometric ratios", "Ratios"), ("Trigonometric ratios", "Continued"), ("Trigonometric ratios", "Continued"), ("Trigonometric ratios", "Continued"),
         ("Identities", "Identities"), ("Identities", "Continued"), ("Identities", "Continued"), ("Identities", "Continued"),
         ("Problems", "Problems"), ("Problems", "Continued"), ("Problems", "Continued"), ("Revision", "Revision")],
        # Applications of trigonometry — 8
        [("Basics", "Basics"), ("Basics", "Continued"),
         ("Heights and distances", "Problems"), ("Heights and distances", "Continued"), ("Heights and distances", "Continued"), ("Heights and distances", "Continued"),
         ("Case study", "Case study"), ("Revision", "Revision")],
        # Probability — 10
        [("Introduction", "Introduction"), ("Introduction", "Continued"),
         ("Probability concepts", "Concepts"), ("Probability concepts", "Continued"), ("Probability concepts", "Continued"), ("Probability concepts", "Continued"),
         ("Problems", "Problems"), ("Problems", "Continued"), ("Problems", "Continued"), ("Revision", "Revision")],
        # Statistics — 15
        [("Introduction", "Introduction"), ("Introduction", "Continued"), ("Introduction", "Continued"),
         ("Mean", "Mean"), ("Mean", "Continued"), ("Mean", "Continued"), ("Mean", "Continued"),
         ("Median", "Median"), ("Median", "Continued"), ("Median", "Continued"), ("Median", "Continued"),
         ("Graphs", "Graphs"), ("Graphs", "Continued"), ("Graphs", "Continued"), ("Revision", "Revision")],
        # Mathematical modelling — 8
        [("Introduction to modelling", "Introduction"), ("Introduction to modelling", "Continued"), ("Introduction to modelling", "Continued"),
         ("Applications", "Applications"), ("Applications", "Continued"), ("Applications", "Continued"),
         ("Problems", "Problems"), ("Problems", "Continued")],
    ]


def physics_micro():
    ph = [
        ["Reflection Basics", "Spherical Mirrors", "Concave Mirror", "Convex Mirror", "Image Formation Rules", "Ray Diagrams", "Mirror Formula", "Magnification"],
        ["Writing Chemical Equations", "Balancing Equations", "Types of Reactions", "Combination", "Decomposition"],
        ["Properties of Acids & Bases", "Indicators and pH scale", "Strength of Acids/Bases", "Chemical Reactions", "Salts Formation", "Uses in Daily Life", "Practice", "Revision"],
        ["Refraction Basics", "Laws of Refraction", "Lenses", "Convex Lens", "Concave Lens", "Image Formation", "Lens Formula", "Magnification"],
        ["Structure of Eye", "Image Formation in Eye", "Defects of Vision", "Myopia", "Hypermetropia", "Dispersion of Light", "Scattering of Light", "Revision"],
        ["Atomic Models", "Dalton", "Thomson", "Rutherford", "Bohr", "Subatomic Particles", "Revision"],
        ["Classification of Elements", "Modern Periodic Table", "Periods & Groups", "Trends", "Atomic Size", "Valency", "Reactivity", "Revision"],
        ["Ionic Bonding", "Covalent Bonding", "Properties of Compounds", "Formation of Molecules", "Chemical Structures", "Applications", "Practice", "Revision"],
        ["Electric Current", "Potential Difference", "Ohm’s Law", "Resistance", "Series & Parallel Circuits", "Electric Power", "Practice", "Revision"],
        ["Magnetic Effects of Current", "Electromagnets", "Fleming’s Rules", "Electric Motor", "Generator", "Electromagnetic Induction", "Applications", "Revision"],
        ["Occurrence of Metals", "Extraction of Metals", "Concentration of Ores", "Refining", "Corrosion", "Revision"],
        ["Properties of Carbon", "Covalent Bonding in Carbon", "Hydrocarbons", "Functional Groups", "Homologous Series", "Uses of Carbon Compounds", "Applications", "Revision"],
    ]
    return [[(c, c) for c in row] for row in ph]


def bio_micro():
    return [
        [("Introduction and types of nutrition", "Introduction"), ("Autotrophic nutrition", "Autotrophic nutrition"), ("Photosynthesis process", "Photosynthesis"),
         ("Factors affecting photosynthesis", "Factors"), ("Experiments", "Experiments"), ("Heterotrophic nutrition", "Heterotrophic nutrition"),
         ("Digestive system", "Digestive system"), ("Enzymes and digestion", "Enzymes"), ("Diseases", "Nutrition-related diseases"), ("Revision", "Revision")],
        [("Introduction", "Introduction"), ("Breathing process", "Breathing"), ("Lungs structure", "Lungs"), ("Gaseous exchange", "Gas exchange"),
         ("Transport of gases", "Transport"), ("Cellular respiration", "Cellular respiration"), ("Aerobic respiration", "Aerobic"),
         ("Anaerobic respiration", "Anaerobic"), ("Differences", "Compare aerobic vs anaerobic"), ("Revision", "Revision")],
        [("Blood components", "Blood"), ("Functions", "Functions"), ("Heart structure", "Heart"), ("Working of heart", "Cardiac cycle"),
         ("Double circulation", "Circulation"), ("Blood vessels", "Vessels"), ("Lymph", "Lymph"), ("Disorders", "Disorders"), ("Diagram practice", "Diagrams"), ("Revision", "Revision")],
        [("Introduction", "Introduction"), ("Human excretory system", "System overview"), ("Kidney structure", "Kidney"), ("Nephron", "Nephron"),
         ("Urine formation", "Urine formation"), ("Excretion in plants", "Plants"), ("Disorders", "Disorders"), ("Dialysis", "Dialysis"), ("Diagram", "Diagrams"), ("Revision", "Revision")],
        [("Introduction", "Introduction"), ("Nervous system", "Nervous system"), ("Brain structure", "Brain"), ("Reflex actions", "Reflexes"),
         ("Hormones", "Hormones"), ("Endocrine glands", "Endocrine"), ("Coordination in plants", "Plants"), ("Tropism", "Tropism"), ("Differences", "Compare systems"), ("Revision", "Revision")],
        [("Introduction", "Introduction"), ("Asexual methods", "Asexual"), ("Binary fission", "Binary fission"), ("Budding", "Budding"),
         ("Vegetative propagation", "Vegetative"), ("Sexual reproduction", "Sexual overview"), ("Male system", "Male reproductive system"),
         ("Female system", "Female reproductive system"), ("Fertilization", "Fertilization"), ("Development", "Development"), ("Reproductive health", "Health"),
         ("Diseases", "Diseases"), ("Population control", "Population"), ("Case study", "Case study"), ("Revision", "Revision")],
        [("System integration", "Integration"), ("System integration", "Integration continued"), ("System integration", "Integration continued"),
         ("Hormonal control", "Hormonal control"), ("Hormonal control", "Hormonal control continued"), ("Case studies", "Case studies"),
         ("Case studies", "Case studies continued"), ("Case studies", "Case studies continued"), ("Revision", "Revision")],
        [("Introduction", "Introduction"), ("Mendel", "Mendel"), ("Laws", "Laws"), ("Traits", "Traits"), ("Punnett square", "Punnett square"),
         ("Variation", "Variation"), ("Evolution", "Evolution"), ("Natural selection", "Natural selection"), ("Darwin theory", "Darwin"),
         ("Human evolution", "Human evolution"), ("Case studies", "Case studies"), ("Case studies", "Case studies continued"),
         ("Case studies", "Case studies continued"), ("Case studies", "Case studies continued"), ("Revision", "Revision")],
        [("Ecosystem", "Ecosystem"), ("Components", "Components"), ("Food chains", "Food chains"), ("Food web", "Food web"), ("Energy flow", "Energy flow"),
         ("Pollution", "Pollution"), ("Waste management", "Waste"), ("Conservation", "Conservation"), ("Case study", "Case study"), ("Revision", "Revision")],
        [("Introduction", "Introduction"), ("Air", "Air"), ("Water", "Water"), ("Soil", "Soil"), ("Forest", "Forest"), ("Energy", "Energy"),
         ("Sustainable use", "Sustainability"), ("Environmental issues", "Issues"), ("Case study", "Case study"), ("Revision", "Revision")],
    ]


def social_micro():
    return [
        [("Location and map", "Location and map"), ("Latitudes and longitudes", "Coordinates"), ("Geological history", "Geology"),
         ("Himalayas", "Himalayas"), ("Plains", "Plains"), ("Plateau", "Plateau"), ("Desert and coast", "Desert and coast"), ("Revision", "Revision")],
        [("Introduction", "Introduction"), ("Goals", "Goals"), ("Conflicts", "Conflicts"), ("Income", "Income"), ("Public facilities", "Public facilities"),
         ("HDI", "HDI"), ("Revision", "Revision")],
        [("Introduction", "Introduction"), ("Primary sector", "Primary"), ("Secondary sector", "Secondary"), ("Tertiary sector", "Tertiary"),
         ("Employment types", "Employment"), ("Organized and unorganized", "Sectors"), ("Case study", "Case study"), ("Revision", "Revision")],
        [("Climate basics", "Basics"), ("Factors", "Factors"), ("Monsoon", "Monsoon"), ("Seasons", "Seasons"), ("Rainfall", "Rainfall"),
         ("Regions", "Regions"), ("Map work", "Maps"), ("Revision", "Revision")],
        [("Introduction", "Introduction"), ("Himalayan rivers", "Himalayan"), ("Peninsular rivers", "Peninsular"), ("Irrigation", "Irrigation"),
         ("Conservation", "Conservation"), ("Issues", "Issues"), ("Revision", "Revision")],
        [("Introduction", "Introduction"), ("Growth", "Growth"), ("Density", "Density"), ("Literacy", "Literacy"), ("Migration", "Migration"), ("Revision", "Revision")],
        [("Types of settlements", "Types"), ("Rural", "Rural"), ("Urban", "Urban"), ("Migration types", "Migration types"), ("Causes", "Causes"),
         ("Effects", "Effects"), ("Revision", "Revision")],
        [("Village introduction", "Introduction"), ("Farming", "Farming"), ("Non-farm activities", "Non-farm"), ("Credit", "Credit"), ("Issues", "Issues"), ("Revision", "Revision")],
        [("Meaning", "Meaning"), ("Liberalisation", "Liberalisation"), ("MNCs", "MNCs"), ("Impact", "Impact"), ("Pros and cons", "Pros and cons"), ("Revision", "Revision")],
        [("Meaning", "Meaning"), ("PDS", "PDS"), ("Buffer stock", "Buffer stock"), ("Programs", "Programs"), ("Issues", "Issues"), ("Revision", "Revision")],
        [("Meaning", "Meaning"), ("Resources", "Resources"), ("Issues", "Issues"), ("Conservation", "Conservation"), ("Equity", "Equity"), ("Case study", "Case study"), ("Revision", "Revision")],
        [("Causes of WW1", "WW1 causes"), ("WW1 events", "WW1 events"), ("Aftermath", "Aftermath"), ("Causes of WW2", "WW2 causes"), ("WW2 events", "WW2 events"),
         ("Impact", "Impact"), ("Comparison", "Comparison"), ("Revision", "Revision")],
        [("Movements overview", "Movements"), ("Movements overview", "Movements continued"), ("Movements overview", "Movements continued"),
         ("Movements overview", "Movements continued"), ("Revision", "Revision")],
        [("Freedom struggle overview", "Struggle"), ("Freedom struggle overview", "Struggle continued"), ("Freedom struggle overview", "Struggle continued"),
         ("Freedom struggle overview", "Struggle continued"), ("Freedom struggle overview", "Struggle continued"), ("Revision", "Revision")],
        [("Constitution features", "Features"), ("Constitution features", "Features continued"), ("Constitution features", "Features continued"),
         ("Constitution features", "Features continued"), ("Revision", "Revision")],
        [("Election process overview", "Process"), ("Election process overview", "Process continued"), ("Election process overview", "Process continued"),
         ("Election process overview", "Process continued"), ("Revision", "Revision")],
        [("Development overview", "Development"), ("Development overview", "Development continued"), ("Development overview", "Development continued"),
         ("Development overview", "Development continued"), ("Revision", "Revision")],
        [("Political changes", "Changes"), ("Political changes", "Changes continued"), ("Political changes", "Changes continued"),
         ("Political changes", "Changes continued"), ("Revision", "Revision")],
        [("Cold War overview", "Cold War"), ("Cold War overview", "Cold War continued"), ("Cold War overview", "Cold War continued"),
         ("Cold War overview", "Cold War continued"), ("Revision", "Revision")],
        [("Types of movements", "Movements"), ("Types of movements", "Movements continued"), ("Types of movements", "Movements continued"),
         ("Types of movements", "Movements continued"), ("Revision", "Revision")],
        [("Telangana movement overview", "Movement"), ("Telangana movement overview", "Movement continued"), ("Telangana movement overview", "Movement continued"),
         ("Telangana movement overview", "Movement continued"), ("Telangana movement overview", "Movement continued"), ("Revision", "Revision")],
    ]


def emit_topics_and_micro(chapter_ids):
    """chapter_ids: ordered list of chapter id ints matching build chapter order."""
    out_topics = []
    out_micro = []
    tid = 1
    idx = 0

    def add_block(cid, periods_list):
        nonlocal tid, idx
        for order, (concept, plan) in enumerate(periods_list, start=1):
            out_topics.append(f"({tid},{cid},'{esc(concept)}',{order},'not_started')")
            out_micro.append(f"({tid},{order},'{esc(concept)}','{esc(plan)}')")
            tid += 1
        idx += 1

    for block in telugu_micro():
        add_block(chapter_ids[idx], block)
    for block in hindi_micro():
        add_block(chapter_ids[idx], block)
    for block in english_micro():
        add_block(chapter_ids[idx], block)
    for block in math_micro():
        add_block(chapter_ids[idx], block)
    for block in physics_micro():
        add_block(chapter_ids[idx], block)
    for block in bio_micro():
        add_block(chapter_ids[idx], block)
    for block in social_micro():
        add_block(chapter_ids[idx], block)

    return out_topics, out_micro, tid - 1


def main():
    ch_rows, max_cid = build_chapters()
    chapter_ids = list(range(1, max_cid + 1))
    t_rows, m_rows, _ = emit_topics_and_micro(chapter_ids)

    sql = []
    sql.append("-- Generated by scripts/generate_grade10_curriculum_sql.py — do not edit by hand; regenerate instead.")
    sql.append("USE lms;")
    sql.append("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;")
    sql.append("SET FOREIGN_KEY_CHECKS = 0;")
    sql.append("SET SQL_SAFE_UPDATES = 0;")
    sql.append("-- Clear FK pointers for grade 10 classes before deletes (safer than relying on order)")
    sql.append("UPDATE live_sessions ls JOIN sections sec ON sec.id = ls.class_id SET ls.chapter_id = NULL, ls.topic_id = NULL WHERE sec.grade_id = 10;")
    sql.append("UPDATE live_quiz_sessions lq JOIN sections sec ON sec.id = lq.class_id SET lq.chapter_id = NULL, lq.topic_id = NULL WHERE sec.grade_id = 10;")
    sql.append("DELETE FROM topic_micro_lessons;")
    sql.append("DELETE FROM topics;")
    sql.append("DELETE FROM chapter_textual_materials WHERE chapter_id IN (SELECT id FROM chapters WHERE grade_id = 10);")
    sql.append("DELETE FROM chapters WHERE grade_id = 10;")
    sql.append("")
    sql.append("INSERT INTO chapters (id, subject_id, grade_id, chapter_no, chapter_name, macro_month_label, macro_week_range, planned_periods, teaching_plan_summary) VALUES")
    sql.append(",\n".join(ch_rows) + ";")
    sql.append(f"ALTER TABLE chapters AUTO_INCREMENT = {max_cid + 1};")
    sql.append("")
    sql.append("INSERT INTO topics (id, chapter_id, name, order_num, status) VALUES")
    sql.append(",\n".join(t_rows) + ";")
    sql.append(f"ALTER TABLE topics AUTO_INCREMENT = {len(t_rows) + 1};")
    sql.append("")
    sql.append("INSERT INTO topic_micro_lessons (topic_id, period_no, concept_text, plan_text) VALUES")
    sql.append(",\n".join(m_rows) + ";")
    sql.append("")
    sql.append("SET FOREIGN_KEY_CHECKS = 1;")
    sql.append("SET SQL_SAFE_UPDATES = 1;")
    sql.append("-- Next: run february_live_sessions_curriculum_update.sql then db_load_checklist.sql")

    text = "\n".join(sql) + "\n"
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"Wrote {OUT} ({len(ch_rows)} chapters, {len(t_rows)} topics, {len(m_rows)} micro rows)")


if __name__ == "__main__":
    main()
