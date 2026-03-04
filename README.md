NCC Cadet Management System 🎖️ Project Overview Ye ek Full-Stack Web Application hai jo NCC (National Cadet Corps) ke cadets ka data manage karne ke liye banayi gayi hai. Iska maqsad paper-work ko khatam karke digital record-keeping ko badhava dena hai.

Key Features (Explanation ke liye) Digital Registration: Cadets apni details (Name, Wing, College, etc.) online bhar sakte hain.

Admin Dashboard: Ek secure panel jahan se Admin saare cadets ki list dekh sakta hai.

Approval System: Naye cadets pehle "Pending" status mein hote hain. Admin unhe verify karke "Approve" ya "Delete" kar sakta hai.

PDF Generation: Registration ke baad cadet apna details preview karke PDF download kar sakta hai.

Search & Filter: Enrollment number ya naam se kisi bhi cadet ko turant dhunda ja sakta hai.

Tech Stack (Jo aapne use kiya) Frontend: HTML5, CSS3, JavaScript, Bootstrap (For Responsive UI).

Backend: Node.js, Express.js.

Database: MySQL (For persistent data storage).

How to Run Clone this repository.

Run npm install to get dependencies.

Import the MySQL database schema.

Start the server using node server.js.

External Examiner ke liye Tips: Workflow dikhayein: Unhe batayein ki kaise data Frontend se Node.js server ke raste MySQL database mein jata hai.

Status Update: Unhe "Approve" button daba kar dikhayein ki kaise status Pending (Yellow) se Approved (Green) ho jata hai.

Security: Batayein ki Dashboard ko localStorage se protect kiya gaya hai taaki unauthorized log login na kar sakein.
