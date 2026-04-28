// Using native fetch available in Node 22
const BASE_URL = "http://localhost:3001/api";

async function runTests() {
  console.log("🚀 Starting Subjects API Tests...");

  try {
    // 1. Login as Admin
    console.log("\n--- Step 1: Login as Admin ---");
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin1@aliet.com",
        password: "passadmin123"
      })
    });
    
    const loginData = await loginRes.json();
    if (!loginRes.ok) throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
    
    const token = loginData.token;
    console.log("✅ Login successful. Token obtained.");

    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    };

    // 2. Create a Subject
    console.log("\n--- Step 2: Create a New Subject ---");
    const createRes = await fetch(`${BASE_URL}/subjects`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Test Subject",
        grades: "10,11",
        icon: "🧪"
      })
    });
    const newSubject = await createRes.json();
    console.log("✅ Created Subject:", newSubject);
    const subjectId = newSubject.id;

    // 3. Get All Subjects
    console.log("\n--- Step 3: Get All Subjects ---");
    const getAllRes = await fetch(`${BASE_URL}/subjects`, { headers });
    const allSubjects = await getAllRes.json();
    console.log(`✅ Fetched ${allSubjects.length} subjects.`);

    // 4. Get Specific Subject
    console.log("\n--- Step 4: Get Specific Subject ---");
    const getOneRes = await fetch(`${BASE_URL}/subjects/${subjectId}`, { headers });
    const subjectDetails = await getOneRes.json();
    console.log("✅ Subject Details:", subjectDetails);

    // 5. Update Subject
    console.log("\n--- Step 5: Update Subject ---");
    const updateRes = await fetch(`${BASE_URL}/subjects/${subjectId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        name: "Updated Test Subject",
        icon: "🔬"
      })
    });
    const updateResult = await updateRes.json();
    console.log("✅ Update Result:", updateResult);

    // 6. Delete Subject
    console.log("\n--- Step 6: Delete Subject ---");
    const deleteRes = await fetch(`${BASE_URL}/subjects/${subjectId}`, {
      method: "DELETE",
      headers
    });
    const deleteResult = await deleteRes.json();
    console.log("✅ Delete Result:", deleteResult);

    console.log("\n✨ All tests passed successfully!");

  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.log("\nNOTE: Make sure your backend server is running on http://localhost:3001");
  }
}

runTests();
