import Navbar from "./components/layout/Navbar";
import Login from "./components/layout/Login";
import "./App.css";
import Footer from "./components/layout/Footer";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./components/layout/Landing";
import { Peer } from "./components/layout/Peer";
import { Toaster } from 'sonner'; // Import Toaster

const App = () => {
    return (
        <BrowserRouter basename="/">
            <Toaster richColors position="top-right" /> {/* Add Toaster here */}
            <Navbar />
            <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/Login" element={<Login />} />
                <Route path="/webrtc" element={<Peer />} />
            </Routes>
            <Footer />
        </BrowserRouter>
    );
};

export default App;
