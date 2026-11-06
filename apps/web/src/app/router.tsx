import { createBrowserRouter } from "react-router";
import { AdminBookingPage } from "@/routes/AdminBookingPage";
import { AdminBookingsPage } from "@/routes/AdminBookingsPage";
import { AdminGalleryPage } from "@/routes/AdminGalleryPage";
import { AdminLayout } from "@/routes/AdminLayout";
import { AdminLoginPage } from "@/routes/AdminLoginPage";
import { AdminServicesPage } from "@/routes/AdminServicesPage";
import { AdminStaffPage } from "@/routes/AdminStaffPage";
import { BookingPage } from "@/routes/BookingPage";
import { HomePage } from "@/routes/HomePage";
import { ManageBookingPage } from "@/routes/ManageBookingPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
  },
  {
    path: "/book/:serviceId",
    element: <BookingPage />,
  },
  {
    path: "/manage",
    element: <ManageBookingPage />,
  },
  {
    path: "/manage/:reference",
    element: <ManageBookingPage />,
  },
  {
    path: "/admin/login",
    element: <AdminLoginPage />,
  },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminBookingsPage /> },
      { path: "bookings/:id", element: <AdminBookingPage /> },
      { path: "services", element: <AdminServicesPage /> },
      { path: "staff", element: <AdminStaffPage /> },
      { path: "gallery", element: <AdminGalleryPage /> },
    ],
  },
]);
