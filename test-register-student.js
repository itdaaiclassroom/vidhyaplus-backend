import { registerStudentByPrincipal } from "./backend/server/controllers/principal.controller.js";

async function test() {
  const req = {
    body: {
      school_id: "1",
      section_id: "1",
      first_name: "Test",
      last_name: "Student",
      email: "test.student.500@example.com",
      password: "123",
      category: "General",
      gender: "Male"
    },
    user: { id: 1, role: 'admin' }
  };
  
  const res = {
    status: (code) => {
      console.log("Status:", code);
      return res;
    },
    json: (data) => {
      console.log("Response:", data);
    }
  };
  
  try {
    await registerStudentByPrincipal(req, res);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

test();
