import { NextRequest, NextResponse } from 'next/server';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { SendOtpComponent } from '@/lib/components/SendOtpComponent';
import { LoginComponent } from '@/lib/components/LoginComponent';
import { UserProfileComponent } from '@/lib/components/UserProfileComponent';

export async function POST(request: NextRequest) {
    try {
        const { componentType, props } = await request.json();

        let Component;
        let css = '';

        switch (componentType) {
            case 'SendOtpComponent':
                Component = SendOtpComponent;
                css = `
                    .proxy-send-otp-component {
                        font-family: 'Inter', sans-serif;
                        padding: 20px;
                        border-radius: 8px;
                        background: white;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    }
                `;
                break;
            case 'LoginComponent':
                Component = LoginComponent;
                css = `
                    .proxy-login-component {
                        font-family: 'Inter', sans-serif;
                        max-width: 400px;
                        margin: 0 auto;
                    }
                `;
                break;
            case 'UserProfileComponent':
                Component = UserProfileComponent;
                css = `
                    .proxy-user-profile {
                        font-family: 'Inter', sans-serif;
                        max-width: 600px;
                        margin: 0 auto;
                    }
                `;
                break;
            default:
                return NextResponse.json(
                    { error: 'Unknown component type' },
                    { status: 400 }
                );
        }

        // Server-side render the React component
        const html = renderToString(React.createElement(Component as any, props));

        return NextResponse.json({
            html,
            css,
            componentType,
        });
    } catch (error) {
        console.error('Error rendering component:', error);
        return NextResponse.json(
            { error: 'Failed to render component' },
            { status: 500 }
        );
    }
}
