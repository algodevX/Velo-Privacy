import { render } from 'preact';
import '../styles/base.css';
import '../styles/popup.css';
import { Popup } from './Popup';

render(<Popup />, document.getElementById('root') as HTMLElement);
