// Original (no upstream counterpart). Tests for scripts/check-react-compat.mjs. Run: node --test scripts/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reactCompatProblems } from './check-react-compat.mjs';

test('flags React-19-only named imports from react, also aliased or mixed with others', () => {
  assert.deepEqual(reactCompatProblems(`import { useRef, useEffectEvent } from 'react';`), [
    'useEffectEvent',
  ]);
  assert.deepEqual(reactCompatProblems(`import React, { use as u } from "react";`), ['use']);
  assert.deepEqual(reactCompatProblems(`import * as R from 'react';`), ['*']);
});

test('accepts React 18 hooks and the tap shim', () => {
  assert.deepEqual(reactCompatProblems(`import { useState, useMemo } from 'react';`), []);
  assert.deepEqual(
    reactCompatProblems(`import { useEffectEvent } from '@assistant-ui/tap/react-shim';`),
    [],
  );
  assert.deepEqual(reactCompatProblems(`import { useEffectEvent } from 'react-dom';`), []);
});
