import firebase from 'firebase';
import * as monaco from 'monaco-editor';
import {Firepot} from '../src/index';

firebase.initializeApp({
  apiKey: 'AIzaSyD9v_JB14TMuGpQdcI0xAv4CjR9HI5u9R4',
  databaseURL: 'https://devcertified-98fdd.firebaseio.com/',
  projectId: 'devcertified-98fdd',
});

const element = document.getElementById('monaco-firepot');
element.setAttribute('style', 'width: 500px; height: 500px;');
const firebaseRef = firebase.database().ref();
const model = monaco.editor.createModel('', 'javascript');

model.setEOL(monaco.editor.EndOfLineSequence.LF);
model.pushEOL(monaco.editor.EndOfLineSequence.LF);
const editor = monaco.editor.create(element, {model});
const firepot = new Firepot(firebaseRef, editor, undefined);
