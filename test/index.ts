import 'firebase/database';
import * as monaco from 'monaco-editor';
import firebase from 'firebase/app';
import {Firepot} from '../src/index';

const app = firebase.initializeApp({
  apiKey: process.env.FIREBASE_API_KEY,
  databaseURL: process.env.FIREBASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
});

const element = document.getElementById('monaco-firepot')!;
element.setAttribute('style', 'width: 500px; height: 500px;');
const firebaseRef = firebase.database().ref();
const model = monaco.editor.createModel('', 'javascript');

model.setEOL(monaco.editor.EndOfLineSequence.LF);
model.pushEOL(monaco.editor.EndOfLineSequence.LF);
const editor = monaco.editor.create(element, {model});
const firepot = new Firepot(firebaseRef, editor, undefined);
console.log('Firepot initialized:', firepot);
