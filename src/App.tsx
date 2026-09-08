import { Routes, Route } from 'react-router-dom'
import ScrollToTop from '@/components/layout/ScrollToTop'
import PublicLayout from '@/components/layout/PublicLayout'
import DashboardLayout from '@/components/layout/DashboardLayout'
import CookieConsent from '@/components/layout/CookieConsent'
import ProtectedRoute from '@/routes/ProtectedRoute'
import RoleRoute from '@/routes/RoleRoute'

import Home from '@/pages/public/Home'
import Solutions from '@/pages/public/Solutions'
import Features from '@/pages/public/Features'
import Pricing from '@/pages/public/Pricing'
import Security from '@/pages/public/Security'
import About from '@/pages/public/About'
import Contact from '@/pages/public/Contact'
import BookDemo from '@/pages/public/BookDemo'
import Privacy from '@/pages/public/Privacy'
import Terms from '@/pages/public/Terms'
import Cookies from '@/pages/public/Cookies'
import Login from '@/pages/public/Login'
import Signup from '@/pages/public/Signup'
import NotFound from '@/pages/public/NotFound'

import AdminDashboard from '@/pages/app/admin/Dashboard'
import AdminStudents from '@/pages/app/admin/Students'
import AdminTeachers from '@/pages/app/admin/Teachers'
import AdminClasses from '@/pages/app/admin/Classes'
import AdminAttendance from '@/pages/app/admin/Attendance'
import AdminGrades from '@/pages/app/admin/Grades'
import AdminHomework from '@/pages/app/admin/Homework'
import AdminExams from '@/pages/app/admin/Exams'
import AdminFees from '@/pages/app/admin/Fees'
import AdminAnnouncements from '@/pages/app/admin/Announcements'
import AdminReports from '@/pages/app/admin/Reports'
import AdminAcademicYears from '@/pages/app/admin/AcademicYears'
import AdminTutorials from '@/pages/app/admin/Tutorials'
import AdminSettings from '@/pages/app/admin/Settings'

import TeacherDashboard from '@/pages/app/teacher/Dashboard'
import TeacherClasses from '@/pages/app/teacher/Classes'
import TeacherAttendance from '@/pages/app/teacher/Attendance'
import TeacherGrades from '@/pages/app/teacher/Grades'
import TeacherHomework from '@/pages/app/teacher/Homework'
import TeacherAnnouncements from '@/pages/app/teacher/Announcements'
import TeacherMessages from '@/pages/app/teacher/Messages'
import TeacherTutorials from '@/pages/app/teacher/Tutorials'

import ParentDashboard from '@/pages/app/parent/Dashboard'
import ParentChildren from '@/pages/app/parent/Children'
import ParentAttendance from '@/pages/app/parent/Attendance'
import ParentGrades from '@/pages/app/parent/Grades'
import ParentHomework from '@/pages/app/parent/Homework'
import ParentFees from '@/pages/app/parent/Fees'
import ParentAnnouncements from '@/pages/app/parent/Announcements'
import ParentNotifications from '@/pages/app/parent/Notifications'
import ParentMessages from '@/pages/app/parent/Messages'
import ParentTutorials from '@/pages/app/parent/Tutorials'

export default function App() {
  return (
    <>
      <ScrollToTop />
      <CookieConsent />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/solutions" element={<Solutions />} />
          <Route path="/features" element={<Features />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/security" element={<Security />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/book-demo" element={<BookDemo />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/cookies" element={<Cookies />} />
        </Route>

        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route
          path="/app/admin"
          element={
            <ProtectedRoute>
              <RoleRoute role="admin">
                <DashboardLayout role="admin" />
              </RoleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="students" element={<AdminStudents />} />
          <Route path="teachers" element={<AdminTeachers />} />
          <Route path="classes" element={<AdminClasses />} />
          <Route path="attendance" element={<AdminAttendance />} />
          <Route path="grades" element={<AdminGrades />} />
          <Route path="homework" element={<AdminHomework />} />
          <Route path="exams" element={<AdminExams />} />
          <Route path="fees" element={<AdminFees />} />
          <Route path="announcements" element={<AdminAnnouncements />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="academic-years" element={<AdminAcademicYears />} />
          <Route path="tutorials" element={<AdminTutorials />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        <Route
          path="/app/teacher"
          element={
            <ProtectedRoute>
              <RoleRoute role="teacher">
                <DashboardLayout role="teacher" />
              </RoleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<TeacherDashboard />} />
          <Route path="classes" element={<TeacherClasses />} />
          <Route path="attendance" element={<TeacherAttendance />} />
          <Route path="grades" element={<TeacherGrades />} />
          <Route path="homework" element={<TeacherHomework />} />
          <Route path="announcements" element={<TeacherAnnouncements />} />
          <Route path="messages" element={<TeacherMessages />} />
          <Route path="tutorials" element={<TeacherTutorials />} />
        </Route>

        <Route
          path="/app/parent"
          element={
            <ProtectedRoute>
              <RoleRoute role="parent">
                <DashboardLayout role="parent" />
              </RoleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<ParentDashboard />} />
          <Route path="children" element={<ParentChildren />} />
          <Route path="attendance" element={<ParentAttendance />} />
          <Route path="grades" element={<ParentGrades />} />
          <Route path="homework" element={<ParentHomework />} />
          <Route path="fees" element={<ParentFees />} />
          <Route path="announcements" element={<ParentAnnouncements />} />
          <Route path="notifications" element={<ParentNotifications />} />
          <Route path="messages" element={<ParentMessages />} />
          <Route path="tutorials" element={<ParentTutorials />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}
