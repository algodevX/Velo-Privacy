import { render } from 'preact';
import '../styles/base.css';
import '../styles/options.css';
import { Options } from './Options';

render(<Options />, document.getElementById('root') as HTMLElement);
