import Navbar from './components/layout/Navbar'
import Login from './components/layout/Login'
import './App.css';
import Footer from './components/layout/Footer';
import Board from './components/layout/Board';

const App = () => {
  return (
    <div>
      <Navbar />
      {/* <Login /> */}
      <Board />
      <Footer />
    </div>
  )
}

export default App