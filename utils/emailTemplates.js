const BASE_URL = process.env.NODE_ENV === 'production' ? 'https://uwearuk.com' : 'http://localhost:5000';

// Utility to encode image URLs
const encodeImageUrl = (imagePath) => {
    if (!imagePath) return 'https://via.placeholder.com/50';
    // Ensure the path is a full URL
    const fullUrl = imagePath.startsWith('http') ? imagePath : `${BASE_URL}${imagePath}`;
    // Encode special characters in the URL
    return encodeURI(fullUrl);
};

const generateOrderConfirmationEmail = (order) => {
    const { orderItems, shippingAddress, customerDetails, itemsPrice, shippingPrice, totalPrice, _id } = order;

    const itemsHtml = orderItems
        .map(item => `
            <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 10px; text-align: left;">
                    <img src="${encodeImageUrl(item.image)}" alt="${item.name}" style="width: 50px; height: auto; border-radius: 4px;" />
                </td>
                <td style="padding: 10px; text-align: left;">${item.name} (${item.size})</td>
                <td style="padding: 10px; text-align: center;">${item.quantity}</td>
                <td style="padding: 10px; text-align: right;">£${(item.price * item.quantity).toFixed(2)}</td>
            </tr>
        `)
        .join('');

    return `
        <div style="font-family: Arial, sans-serif; background-color: #f5f7fa; padding: 20px;">
            <!-- Yellow Banner -->
            <div style="background-color: #FFD700; padding: 15px; text-align: center;">
                <img src="${BASE_URL}/Uploads/uwear-logo.png" alt="UWEAR Logo" style="max-width: 150px; height: auto;" />
            </div>
            <!-- Black Divider -->
            <div style="background-color: #000; height: 4px;"></div>
            <!-- Main Content Box -->
            <div style="max-width: 600px; margin: 20px auto; background-color: #fff; border: 2px solid #000; border-radius: 8px; padding: 20px;">
                <h2 style="color: #333; text-align: center;">Thank You for Your Order, ${customerDetails.firstName}!</h2>
                <p style="color: #555; text-align: center;">Your order #${_id} has been successfully placed.</p>
                <h3 style="color: #333;">Order Summary</h3>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <thead>
                        <tr style="background-color: #f5f5f5;">
                            <th style="padding: 10px; text-align: left;">Image</th>
                            <th style="padding: 10px; text-align: left;">Product</th>
                            <th style="padding: 10px; text-align: center;">Quantity</th>
                            <th style="padding: 10px; text-align: right;">Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                <p style="text-align: right; margin: 10px 0;"><strong>Items Total: £${parseFloat(itemsPrice).toFixed(2)}</strong></p>
                <p style="text-align: right; margin: 10px 0;"><strong>Shipping: £${parseFloat(shippingPrice).toFixed(2)}</strong></p>
                <p style="text-align: right; margin: 10px 0;"><strong>Total: £${parseFloat(totalPrice).toFixed(2)}</strong></p>
                <h3 style="color: #333;">Shipping Address</h3>
                <p style="color: #555;">
                    ${shippingAddress.street}, ${shippingAddress.city},<br />
                    ${shippingAddress.postalCode}, ${shippingAddress.country} (${shippingAddress.type})
                </p>
                <div style="text-align: center; margin-top: 20px;">
                    <a href="https://uwearuk.com/account/orders/${_id}" style="background-color: #007bff; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Your Order</a>
                </div>
                <p style="color: #555; text-align: center; margin-top: 20px;">
                    If you have any questions, contact us at <a href="mailto:support@uwearuk.com" style="color: #007bff;">support@uwearuk.com</a>.
                </p>
                <p style="color: #555; text-align: center;">Visit us at <a href="https://uwearuk.com" style="color: #007bff;">uwearuk.com</a></p>
            </div>
        </div>
    `;
};

const generateOrderDispatchedEmail = (order) => {
    const { orderItems, shippingAddress, customerDetails, _id, shippingMethod } = order;

    const itemsHtml = orderItems
        .map(item => `
            <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 10px; text-align: left;">
                    <img src="${encodeImageUrl(item.image)}" alt="${item.name}" style="width: 50px; height: auto; border-radius: 4px;" />
                </td>
                <td style="padding: 10px; text-align: left;">${item.name} (${item.size})</td>
                <td style="padding: 10px; text-align: center;">${item.quantity}</td>
            </tr>
        `)
        .join('');

    return `
        <div style="font-family: Arial, sans-serif; background-color: #f5f7fa; padding: 20px;">
            <!-- Yellow Banner -->
            <div style="background-color: #FFD700; padding: 15px; text-align: center;">
                <img src="${BASE_URL}/Uploads/uwear-logo.png" alt="UWEAR Logo" style="max-width: 150px; height: auto;" />
            </div>
            <!-- Black Divider -->
            <div style="background-color: #000; height: 4px;"></div>
            <!-- Main Content Box -->
            <div style="max-width: 600px; margin: 20px auto; background-color: #fff; border: 2px solid #000; border-radius: 8px; padding: 20px;">
                <h2 style="color: #333; text-align: center;">Your UWEAR Order Has Been Dispatched!</h2>
                <p style="color: #555; text-align: center;">Hello ${customerDetails.firstName}, your order #${_id} has been shipped.</p>
                <h3 style="color: #333;">Order Summary</h3>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <thead>
                        <tr style="background-color: #f5f5f5;">
                            <th style="padding: 10px; text-align: left;">Image</th>
                            <th style="padding: 10px; text-align: left;">Product</th>
                            <th style="padding: 10px; text-align: center;">Quantity</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                <h3 style="color: #333;">Shipping Details</h3>
                <p style="color: #555;">
                    <strong>Address:</strong><br />
                    ${shippingAddress.street}, ${shippingAddress.city},<br />
                    ${shippingAddress.postalCode}, ${shippingAddress.country} (${shippingAddress.type})
                </p>
                <p style="color: #555;"><strong>Shipping Method:</strong> Royal Mail Non-Trackable</p>
                <p style="color: #555;"><strong>Expected Delivery:</strong> Typically within 3-5 working days</p>
                <div style="text-align: center; margin-top: 20px;">
                    <a href="https://uwearuk.com/account/orders/${_id}" style="background-color: #007bff; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Track Your Order</a>
                </div>
                <p style="color: #555; text-align: center; margin-top: 20px;">
                    If you have any questions, contact us at <a href="mailto:support@uwearuk.com" style="color: #007bff;">support@uwearuk.com</a>.
                </p>
                <p style="color: #555; text-align: center;">Visit us at <a href="https://uwearuk.com" style="color: #007bff;">uwearuk.com</a></p>
            </div>
        </div>
    `;
};

export { generateOrderConfirmationEmail, generateOrderDispatchedEmail };