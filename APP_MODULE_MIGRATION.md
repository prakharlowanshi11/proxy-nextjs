# Angular App Module to Next.js Migration Guide

This document details the conversion of Angular's `app.module.ts` and `app.component.ts` to Next.js equivalents.

## 🔄 What Was Converted

### Original Angular Structure (`app.module.ts`)
```typescript
@NgModule({
    declarations: [AppComponent],
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        ElementModule,
        NgHcaptchaModule.forRoot({
            siteKey: environment.hCaptchaSiteKey,
        }),
        ...conditional_imports, // StoreDevtoolsModule in development
    ],
    bootstrap: [AppComponent],
})
export class AppModule {}
```

### New Next.js Structure

## 📁 File Mapping

| Angular File | Next.js Equivalent | Purpose |
|-------------|-------------------|---------|
| `app.module.ts` | `src/app/layout.tsx` | Root app configuration |
| `app.component.ts` | `src/app/proxy-root/page.tsx` | Main app component |
| `environment.ts` | `src/lib/config/environment.ts` | Environment configuration |
| `NgHcaptchaModule` | `src/lib/components/HCaptcha.tsx` | hCaptcha integration |
| `StoreDevtoolsModule` | `src/lib/providers/DevToolsProvider.tsx` | Development tools |

## 🔧 Key Conversions

### 1. Environment Configuration

**Angular:**
```typescript
export const environment = {
    production: false,
    hCaptchaSiteKey: process.env.HCAPTCHA_SITE_KEY,
    // ...
};
```

**Next.js:**
```typescript
export const environment: Environment = {
    production: process.env.NODE_ENV === 'production',
    hCaptchaSiteKey: process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY,
    // ...
};
```

### 2. Module Imports → Providers

**Angular:**
```typescript
imports: [
    BrowserModule,
    BrowserAnimationsModule,
    ElementModule,
    NgHcaptchaModule.forRoot({ siteKey: environment.hCaptchaSiteKey }),
    ...conditional_imports,
]
```

**Next.js:**
```tsx
// In layout.tsx
<DevToolsProvider maxAge={25} serialize={true}>
  {children}
</DevToolsProvider>

// Components used directly in pages
<HCaptcha siteKey={environment.hCaptchaSiteKey} />
<ProxyAuthWrapper config={authConfig} />
```

### 3. Conditional Imports → Environment-based Logic

**Angular:**
```typescript
let conditional_imports = [];
if (environment.production) {
    conditional_imports = [];   
} else {
    conditional_imports.push(
        StoreDevtoolsModule.instrument({
            maxAge: 25,
            serialize: true,
        })
    );
}
```

**Next.js:**
```tsx
// DevToolsProvider automatically handles this
export function DevToolsProvider({ children, maxAge = 25, serialize = true }) {
    const isEnabled = isDevelopment(); // Only active in development
    // ...
}
```

### 4. AppComponent → Page Component

**Angular:**
```typescript
export class AppComponent implements OnInit, OnDestroy {
    ngOnInit() {
        this.initOtpProvider();
    }
    
    public initOtpProvider() {
        if (!environment.production) {
            const sendOTPConfig = { /* config */ };
            window.initVerification(sendOTPConfig);
        }
    }
}
```

**Next.js:**
```tsx
export default function ProxyRootPage() {
    useEffect(() => {
        initOtpProvider();
    }, []);

    const initOtpProvider = () => {
        if (isDevelopment()) {
            const sendOTPConfig = { /* config */ };
            // Use ProxyAuthWrapper component or hook
        }
    };
}
```

## 🚀 Usage Examples

### 1. Environment Variables

Create `.env.local` file:
```bash
NEXT_PUBLIC_HCAPTCHA_SITE_KEY=your_site_key_here
NEXT_PUBLIC_AUTH_UI_ENCODE_KEY=your_encode_key
# ... other variables
```

### 2. Using hCaptcha

```tsx
import { HCaptcha } from '@/lib/components/HCaptcha';

<HCaptcha
    onVerify={(token) => console.log('Verified:', token)}
    onError={(error) => console.error('Error:', error)}
    theme="light"
/>
```

### 3. Using DevTools

```tsx
import { useDevTools } from '@/lib/providers/DevToolsProvider';

function MyComponent() {
    const { addLog } = useDevTools();
    
    const handleAction = () => {
        addLog('info', 'Action performed', { timestamp: Date.now() });
    };
}
```

### 4. Using Proxy Auth

```tsx
import { ProxyAuthWrapper } from '@/lib/components/ProxyAuthWrapper';

<ProxyAuthWrapper
    config={{
        authToken: 'your-token',
        type: 'user-management',
        theme: 'dark',
        success: (data) => console.log('Success:', data),
        failure: (error) => console.error('Error:', error),
    }}
/>
```

## 🔍 Key Differences

### Angular vs Next.js Approach

| Aspect | Angular | Next.js |
|--------|---------|---------|
| **Module System** | NgModule with imports array | React providers and components |
| **Dependency Injection** | Injectable services | React Context/Hooks |
| **Environment Config** | environment.ts with build replacement | Environment variables with NEXT_PUBLIC_ prefix |
| **Conditional Loading** | Conditional imports array | Runtime environment checks |
| **Lifecycle Hooks** | ngOnInit, ngOnDestroy | useEffect hook |
| **Global Services** | Injectable providers | React Context providers |

### Benefits of Next.js Approach

- ✅ **Better Tree Shaking**: Only load what's needed
- ✅ **Runtime Flexibility**: Dynamic environment-based loading
- ✅ **Type Safety**: Full TypeScript support with better inference
- ✅ **Performance**: React's optimized rendering and Next.js optimizations
- ✅ **Developer Experience**: Better debugging and hot reload

## 🛠️ Migration Steps

1. **Copy environment variables** to `.env.local` with `NEXT_PUBLIC_` prefix
2. **Replace NgModule imports** with React providers in `layout.tsx`
3. **Convert components** from Angular to React
4. **Update lifecycle hooks** from Angular to React hooks
5. **Test functionality** to ensure all features work correctly

## 🐛 Common Issues & Solutions

### Issue: Environment variables not loading
**Solution:** Ensure variables start with `NEXT_PUBLIC_` for client-side access

### Issue: hCaptcha not rendering
**Solution:** Check that the site key is correctly configured and the script loads

### Issue: DevTools not showing
**Solution:** Ensure you're in development mode (`NODE_ENV=development`)

### Issue: Proxy Auth not initializing
**Solution:** Verify the script is loaded and configuration is correct

## 📝 Notes

- All Angular functionality has been preserved in the Next.js version
- The conversion maintains the same API surface for easy migration
- Development tools are only active in development mode
- Environment-based conditional loading is handled at runtime
- React hooks provide better lifecycle management than Angular lifecycle hooks
