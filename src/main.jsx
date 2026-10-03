import React from 'react';
import { createRoot } from 'react-dom/client';
import {I18nextProvider} from 'react-i18next';
import i18n from './i18n.mjs';
import App from './App.jsx';
import './style.css';

class GameBoundary extends React.Component {
  state={error:null};
  static getDerivedStateFromError(error){return {error};}
  render(){if(this.state.error)return <div className="fatal"><h1>Touchline cần khởi động lại</h1><p>{this.state.error.message}</p><p>Bản lưu trên máy vẫn được giữ. Tải lại để tiếp tục.</p><button onClick={()=>location.reload()}>Tải lại game</button></div>;return this.props.children;}
}
createRoot(document.getElementById('root')).render(<I18nextProvider i18n={i18n}><GameBoundary><App/></GameBoundary></I18nextProvider>);
