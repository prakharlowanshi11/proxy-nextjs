# Proxy Auth - Angular to Next.js Conversion

This document describes the conversion of Angular Elements-based Proxy Auth functionality to Next.js.

## 🔄 What Was Converted

The original Angular code (`element.module.ts`) has been converted into several Next.js-compatible files:

### Original Angular Structure
- **Angular Elements**: Custom elements using `createCustomElement`
- **Global Function**: `window.initVerification`
- **DOM Manipulation**: Direct DOM element creation and manipulation
- **Angular Dependencies**: BrowserModule, BrowserAnimationsModule, etc.

### New Next.js Structure
- **React Components**: `ProxyAuthWrapper` component
- **React Hook**: `useProxyAuth` for state management
- **TypeScript Types**: Proper type definitions
- **Utility Functions**: Helper functions for DOM manipulation
- **Custom Elements**: Web Components compatible with React

## 📁 File Structure

```
/public/
  └── proxy-auth.js                    # Global script with custom elements
/src/
  ├── types/
  │   └── proxy-auth.ts               # TypeScript type definitions
  ├── lib/
  │   ├── proxy-auth-utils.ts         # Utility functions
  │   ├── hooks/
  │   │   └── useProxyAuth.ts         # React hook
  │   └── components/
  │       └── ProxyAuthWrapper.tsx    # React wrapper component
  └── app/
      └── proxy-auth-example/
          └── page.tsx                # Example usage page
```

## 🚀 Usage Options

### 1. React Component (Recommended)

```tsx
import { ProxyAuthWrapper } from '@/lib/components/ProxyAuthWrapper';

function MyComponent() {
  return (
    <ProxyAuthWrapper
      config={{
        referenceId: 'your-ref-id',
        authToken: 'your-auth-token',
        success: (data) => console.log('Success:', data),
        failure: (err) => console.error('Error:', err),
      }}
      containerId="proxyContainer"
      className="my-custom-class"
    />
  );
}
```

### 2. React Hook

```tsx
import { useProxyAuth } from '@/lib/hooks/useProxyAuth';

function MyComponent() {
  const { isLoaded, initVerification } = useProxyAuth();

  const handleAuth = () => {
    if (isLoaded) {
      initVerification({
        referenceId: 'your-ref-id',
        success: (data) => console.log('Success:', data),
      });
    }
  };

  return <button onClick={handleAuth}>Start Auth</button>;
}
```

### 3. Global Script (Legacy Support)

```html
<!-- Include in your HTML head -->
<script src="/proxy-auth.js"></script>

<script>
  window.initVerification({
    referenceId: 'your-ref-id',
    success: (data) => console.log('Success:', data),
  });
</script>
```

## 🔧 Configuration Options

All original configuration options are supported:

| Option | Type | Description |
|--------|------|-------------|
| `referenceId` | string | Reference identifier |
| `type` | string | Authentication type |
| `authToken` | string | Authentication token |
| `showCompanyDetails` | boolean | Show company details |
| `userToken` | string | User token |
| `isRolePermission` | boolean | Role permission flag |
| `isPreview` | boolean | Preview mode |
| `isLogin` | boolean | Login mode |
| `loginRedirectUrl` | string | Redirect URL after login |
| `theme` | string | UI theme |
| `target` | string | Link target (`_self`, `_blank`, etc.) |
| `style` | string | Custom CSS styles |
| `success` | function | Success callback (required) |
| `failure` | function | Failure callback |

## 🔄 Migration Guide

### From Angular Elements

**Before (Angular):**
```typescript
window['initVerification'] = (config: any) => {
  // Angular Elements creation
  const sendOtpElement = document.createElement('proxy-auth') as NgElement;
  // ... configuration
};
```

**After (Next.js):**
```tsx
import { ProxyAuthWrapper } from '@/lib/components/ProxyAuthWrapper';

<ProxyAuthWrapper config={config} />
```

### Key Differences

1. **No Angular Dependencies**: Removed Angular-specific imports and modules
2. **React Integration**: Added React hooks and components for better integration
3. **TypeScript Support**: Proper type definitions for better development experience
4. **Custom Elements**: Maintained Web Components compatibility for legacy support
5. **Error Handling**: Improved error handling and loading states

## 🎯 Benefits of Conversion

- ✅ **React Integration**: Native React components and hooks
- ✅ **TypeScript Support**: Full type safety
- ✅ **Better Performance**: No Angular runtime overhead
- ✅ **Maintainability**: Cleaner, more maintainable code structure
- ✅ **Flexibility**: Multiple usage patterns (component, hook, script)
- ✅ **Backward Compatibility**: Still supports global script usage

## 🔍 Example

Visit `/proxy-auth-example` to see a working example with:
- Live authentication component
- Configuration display
- Success/error handling
- Usage instructions

## 🐛 Troubleshooting

### Common Issues

1. **Script not loading**: Ensure `/proxy-auth.js` is accessible in your public folder
2. **TypeScript errors**: Make sure all type definitions are properly imported
3. **Custom elements not defined**: The script needs to load before using custom elements

### Debug Tips

- Check browser console for errors
- Verify `window.initVerification` is available
- Ensure success callback is provided (required)
- Check that container elements exist in DOM

## 📝 Notes

- The conversion maintains the same API surface for easy migration
- Custom elements are still used for maximum compatibility
- React components provide better integration with Next.js applications
- All original functionality has been preserved
