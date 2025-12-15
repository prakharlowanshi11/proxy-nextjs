import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { referenceId, authToken, type, otherData } = body;

        // Simulate OTP sending logic
        // In a real implementation, this would integrate with your OTP service
        
        console.log('Sending OTP:', { referenceId, type, authToken: authToken ? '***' : undefined });

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Mock successful response
        const response = {
            success: true,
            message: 'OTP sent successfully',
            data: {
                referenceId,
                otpSent: true,
                expiryTime: Date.now() + (5 * 60 * 1000), // 5 minutes from now
            },
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error sending OTP:', error);
        return NextResponse.json(
            { 
                success: false, 
                error: 'Failed to send OTP',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
