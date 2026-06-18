import fetch from 'node-fetch';

async function main() {
  const res = await fetch('http://localhost:3001/api/all');
  const data = await res.json();
  console.log('Students count:', data.students?.length);
  if (data.students?.length > 0) {
    console.log('Sample student:', data.students[0]);
  }
  
  console.log('studentQuizResults count:', data.studentQuizResults?.length);
  if (data.studentQuizResults?.length > 0) {
    console.log('Sample quiz result:', data.studentQuizResults[0]);
  }

  console.log('rawAttendance count:', data.rawAttendance?.length);
  if (data.rawAttendance?.length > 0) {
    console.log('Sample attendance record:', data.rawAttendance[0]);
  }
}

main().catch(console.error);
