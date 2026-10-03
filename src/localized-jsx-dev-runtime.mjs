import {jsxDEV as reactJsxDEV,Fragment} from 'react/jsx-dev-runtime';
import {localizedProps} from './localized-jsx-runtime.mjs';
export function jsxDEV(type,props,...rest){return reactJsxDEV(type,localizedProps(props),...rest);}
export {Fragment};
