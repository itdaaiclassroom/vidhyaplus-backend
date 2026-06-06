import { registerTeacherByPrincipal } from "./backend/server/controllers/principal.controller.js";

async function test() {
  const req = {
    body: {
      school_id: "1",
      full_name: "Test Teacher",
      email: "test.teacher.500@example.com",
      password: "123",
      subjects: [1]
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
  
  await registerTeacherByPrincipal(req, res);
  process.exit(0);
}

test();
