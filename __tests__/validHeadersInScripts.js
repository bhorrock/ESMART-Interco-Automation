/* eslint-disable import/no-extraneous-dependencies */
/* global describe, it, expect, jest, beforeEach, afterEach */
import { extract, parseWithComments } from 'jest-docblock';
import dirTree from 'directory-tree';
import { readFileSync } from 'node:fs';

const aFileContents = [];

dirTree('./src/FileCabinet', { extensions: /\.js$/ }, (oFile) => {
  console.log(oFile);
  const fileText = readFileSync(oFile.path, 'utf8', (err, data) => {
    if (err) throw err;
    console.log(data);
  });
  oFile.commentBlock = parseWithComments(extract(fileText));
  aFileContents.push(oFile);
});
// console.log(aFileContents);

describe('Each NetSuite script should have a valid JsDoc style header', () => {
  it('should start with a comment block', () => {
    aFileContents.forEach((oFile) => {
      expect(oFile.commentBlock).not.toBeUndefined();
      expect(oFile.commentBlock).not.toBe('');
    });
  });

  it('should contain an @author pragma with a value', () => false);

  it('should contain a @copyright pragma with a year and the company name', () => false);

  it('should contain an @NApiVersion pragma with one of [1.0, 2.0, 2.1]', () => {
    aFileContents.forEach((oFile) => {
      expect(oFile.commentBlock.pragmas.NApiVersion).toBe('2.1');
    });
  });

  it('should contain an @NScriptType pragma with one of [ClientScript, Suitelet, UserEvent, ScheduledScript, MapReduceScript]', () => false);
});
