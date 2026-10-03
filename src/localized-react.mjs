import {createElement as reactCreateElement} from 'react';
import {localizedProps,localizedChildren} from './localized-jsx-runtime.mjs';
// esbuild uses createElement for JSX with a key after a spread.
export function createElement(type,props,...children){
 return reactCreateElement(type,localizedProps(props),...(props?.translate==='no'?children:localizedChildren(children)));
}
